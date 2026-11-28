-- Monkey Family — rotation v2 (à partir du lundi 30/11/2026)
-- Menu « Jeux » : 1 jeu fixe (Monkey Run), 1 jeu de l'Arène en rotation, 3 jeux du Casino tirés au hasard chaque lundi à 0 h (Paris).
--   pool        = jeux du Casino qui tournent (slots = 3) : tirage au hasard, en évitant les jeux de la semaine d'avant
--   arena_pool  = jeux compétitifs de l'Arène (arena_slots = 1) : chacun son tour, dans l'ordre de la liste
--                 (30/11 Flying Monkey, 07/12 Monkey Rush, 14/12 Monkey Jump, 21/12 Flying Monkey…)
-- Hors des deux listes = toujours ouvert (Monkey Run, L'Expédition).
-- Choix manuel de l'admin (manual) : les jeux cochés de chaque liste remplacent le tirage de cette liste pour la semaine suivante.

alter table public.mf_casino_cfg
  add column if not exists arena_pool text[] not null default array['fly','rush','jump'],
  add column if not exists arena_slots int not null default 1 check (arena_slots between 1 and 10);

update public.mf_casino_cfg set
  pool = array['slot','scratch','wheel','mine','tour','coco','bj','bon','vp','pk'], slots = 3,
  arena_pool = array['fly','rush','jump'], arena_slots = 1
where id = 1;

create or replace function public._casino_featured() returns text[]
language plpgsql security definer set search_path to 'public' as $$
declare c public.mf_casino_cfg; w date := public._casino_monday(); g text[]; prev text[]; cand text[];
  cg text[]; ag text[]; n int; k int; j int; i int;
begin
  select * into c from public.mf_casino_cfg where id = 1;
  -- rotation coupée pour un temps : elle se remet en marche toute seule à la date prévue
  if not coalesce(c.enabled, false) and c.enabled_from is not null and now() >= c.enabled_from then
    update public.mf_casino_cfg set enabled = true, enabled_from = null where id = 1;
    select * into c from public.mf_casino_cfg where id = 1;
  end if;
  if not coalesce(c.enabled, false) then return c.pool || c.arena_pool; end if;
  select games into g from public.mf_casino_week where week = w;
  if g is not null then return g; end if;
  if c.manual is not null and cardinality(c.manual) > 0 then
    cg := array(select x from unnest(c.manual) x where x = any(c.pool));
    ag := array(select x from unnest(c.manual) x where x = any(c.arena_pool));
    update public.mf_casino_cfg set manual = null where id = 1;
  end if;
  -- Casino : au hasard, sans reprendre les jeux de la semaine d'avant quand il en reste assez
  if coalesce(cardinality(cg), 0) = 0 and cardinality(c.pool) > 0 then
    k := least(c.slots, cardinality(c.pool));
    select games into prev from public.mf_casino_week where week < w order by week desc limit 1;
    cand := array(select x from unnest(c.pool) x where not (x = any(coalesce(prev, '{}'))));
    if cardinality(cand) < k then cand := c.pool; end if;
    cg := array(select y from (select x as y from unnest(cand) x order by random() limit k) s order by array_position(c.pool, y));
  end if;
  -- Arène : chacun son tour (semaine du 30/11/2026 = premier jeu de la liste)
  if coalesce(cardinality(ag), 0) = 0 and cardinality(c.arena_pool) > 0 then
    n := cardinality(c.arena_pool); k := least(c.arena_slots, n); ag := '{}';
    i := ((w - date '2026-11-30') / 7) * k;
    for j in 0..k-1 loop ag := ag || c.arena_pool[(((i + j) % n) + n) % n + 1]; end loop;
  end if;
  g := coalesce(cg, '{}') || coalesce(ag, '{}');
  insert into public.mf_casino_week(week, games) values (w, g) on conflict (week) do nothing;
  select games into g from public.mf_casino_week where week = w;
  perform public._feed(jsonb_build_object('kind', 'casino_week', 'games', to_jsonb(g),
    'arena', to_jsonb(array(select x from unnest(g) x where x = any(c.arena_pool)))));
  return g;
end $$;
revoke execute on function public._casino_featured() from public, anon, authenticated;

-- un jeu est-il jouable cette semaine ? (les jeux hors des deux listes le sont toujours)
create or replace function public._casino_on(p_id text) returns boolean
language sql security definer set search_path to 'public' as $$
  select not (p_id = any(c.pool) or p_id = any(c.arena_pool)) or p_id = any(public._casino_featured())
  from public.mf_casino_cfg c where c.id = 1 $$;

create or replace function public.mf_casino_status() returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare c public.mf_casino_cfg; w date := public._casino_monday(); f text[];
begin
  perform public._check();
  f := public._casino_featured();
  select * into c from public.mf_casino_cfg where id = 1;
  return jsonb_build_object('enabled', c.enabled, 'pool', to_jsonb(c.pool), 'arena_pool', to_jsonb(c.arena_pool), 'featured', to_jsonb(f),
    'week', w, 'next', (extract(epoch from ((w + 7)::timestamp at time zone 'Europe/Paris')) * 1000)::bigint,
    'now', (extract(epoch from now()) * 1000)::bigint,
    'from', case when c.enabled_from is not null then (extract(epoch from c.enabled_from) * 1000)::bigint end,
    'slots', c.slots, 'arena_slots', c.arena_slots, 'manual', case when public.is_admin() then to_jsonb(c.manual) end);
end $$;

-- réglages admin : p = {enabled, slots, arena_slots, manual (liste ou null), now (true = appliquer tout de suite)}
create or replace function public.mf_casino_admin(p jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.mf_casino_cfg set
    enabled = coalesce((p->>'enabled')::boolean, enabled),
    enabled_from = case when (p->>'enabled')::boolean then null else enabled_from end,
    slots = coalesce((p->>'slots')::int, slots),
    arena_slots = coalesce((p->>'arena_slots')::int, arena_slots),
    manual = case when p ? 'manual' then (case when jsonb_typeof(p->'manual') = 'array' then array(select jsonb_array_elements_text(p->'manual')) end) else manual end
  where id = 1;
  if coalesce((p->>'now')::boolean, false) then delete from public.mf_casino_week where week = public._casino_monday(); end if;
  return public.mf_casino_status();
end $$;

-- Banana Machine, Monkey Cash et The Monkey Wheel entrent dans la rotation : on leur ajoute le même verrou que les autres
create or replace function public.mf_slot_open() returns boolean
language sql security definer set search_path to 'public' as $$ select public._casino_on('slot') $$;
create or replace function public.mf_scratch_open() returns boolean
language sql volatile security definer set search_path to 'public' as $$
  select coalesce((select open from public.mf_scratch_cfg where id = 1), false) and public._casino_on('scratch') $$;
create or replace function public.mf_wheel_open() returns boolean
language sql volatile security definer set search_path to 'public' as $$
  select coalesce((select open from public.mf_wheel_cfg where id = 1), false) and public._casino_on('wheel') $$;
revoke execute on function public.mf_slot_open() from public, anon;
grant execute on function public.mf_slot_open() to authenticated;

do $$ declare d text; begin
  d := pg_get_functiondef('public.mf_slot_spin(text)'::regprocedure);
  if position('slot_closed' in d) = 0 then
    d := replace(d, E'begin\n  perform public._tick(u);',
      E'begin\n  if not public.mf_slot_open() and not public.is_admin() then raise exception ''slot_closed''; end if;\n  perform public._tick(u);');
    execute d;
  end if;
  d := pg_get_functiondef('public.mf_scratch_buy(boolean,text)'::regprocedure);
  d := replace(d, 'if not coalesce(c.open, false) and not public.is_admin()', 'if not public.mf_scratch_open() and not public.is_admin()');
  execute d;
end $$;
