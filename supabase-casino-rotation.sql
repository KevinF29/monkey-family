-- Monkey Family — Casino : rotation des « jeux de la semaine »
-- Jeux fixes : Banana Machine, Monkey Cash, The Monkey Wheel (hors pool, jamais touchés).
-- Jeux qui tournent : la liste « pool » (au départ Monkey Run et Crash Cocotier). Changement le lundi à 0 h (heure de Paris).
-- Tant que enabled = false, rien ne change : tous les jeux du pool restent ouverts.

create table if not exists public.mf_casino_cfg (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  slots int not null default 1 check (slots between 1 and 10),
  pool text[] not null default array['race','coco'],
  manual text[]                                   -- choix forcé par l'admin pour la semaine suivante (null = rotation auto)
);
insert into public.mf_casino_cfg(id) values (1) on conflict do nothing;
alter table public.mf_casino_cfg enable row level security;

create table if not exists public.mf_casino_week (
  week date primary key,
  games text[] not null,
  created_at timestamptz not null default now()
);
alter table public.mf_casino_week enable row level security;

create or replace function public._casino_monday() returns date language sql stable as $$
  select date_trunc('week', now() at time zone 'Europe/Paris')::date $$;

-- jeux de la semaine en cours (créés au premier appel de la semaine, annoncés dans le fil d'actu)
create or replace function public._casino_featured() returns text[]
language plpgsql security definer set search_path to 'public' as $$
declare c public.mf_casino_cfg; w date := public._casino_monday(); g text[]; n int; k int; i int; j int;
begin
  select * into c from public.mf_casino_cfg where id = 1;
  if not coalesce(c.enabled, false) then return c.pool; end if;
  select games into g from public.mf_casino_week where week = w;
  if g is not null then return g; end if;
  if c.manual is not null and cardinality(c.manual) > 0 then
    g := array(select x from unnest(c.manual) x where x = any(c.pool));
    update public.mf_casino_cfg set manual = null where id = 1;
  end if;
  if g is null or cardinality(g) = 0 then
    n := cardinality(c.pool); k := least(c.slots, n); g := '{}';
    i := ((w - date '2026-01-05') / 7) * k;
    for j in 0..k-1 loop g := g || c.pool[((i + j) % n) + 1]; end loop;
  end if;
  insert into public.mf_casino_week(week, games) values (w, g) on conflict (week) do nothing;
  select games into g from public.mf_casino_week where week = w;
  perform public._feed(jsonb_build_object('kind', 'casino_week', 'games', to_jsonb(g)));
  return g;
end $$;

-- un jeu est-il jouable cette semaine ? (les jeux hors pool le sont toujours)
create or replace function public._casino_on(p_id text) returns boolean
language sql security definer set search_path to 'public' as $$
  select not (p_id = any(c.pool)) or p_id = any(public._casino_featured()) from public.mf_casino_cfg c where c.id = 1 $$;

create or replace function public.mf_casino_status() returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare c public.mf_casino_cfg; w date := public._casino_monday();
begin
  perform public._check();
  select * into c from public.mf_casino_cfg where id = 1;
  return jsonb_build_object('enabled', c.enabled, 'pool', to_jsonb(c.pool), 'featured', to_jsonb(public._casino_featured()),
    'week', w, 'next', (extract(epoch from ((w + 7)::timestamp at time zone 'Europe/Paris')) * 1000)::bigint,
    'now', (extract(epoch from now()) * 1000)::bigint,
    'slots', c.slots, 'manual', case when public.is_admin() then to_jsonb(c.manual) end);
end $$;

-- réglages admin : p = {enabled, slots, manual (liste ou null), now (true = appliquer tout de suite)}
create or replace function public.mf_casino_admin(p jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.mf_casino_cfg set
    enabled = coalesce((p->>'enabled')::boolean, enabled),
    slots = coalesce((p->>'slots')::int, slots),
    manual = case when p ? 'manual' then (case when jsonb_typeof(p->'manual') = 'array' then array(select jsonb_array_elements_text(p->'manual')) end) else manual end
  where id = 1;
  if coalesce((p->>'now')::boolean, false) then delete from public.mf_casino_week where week = public._casino_monday(); end if;
  return public.mf_casino_status();
end $$;

grant execute on function public.mf_casino_status() to authenticated, anon;
grant execute on function public.mf_casino_admin(jsonb) to authenticated, anon;
revoke execute on function public._casino_featured() from public, anon, authenticated;

-- les deux jeux qui tournent n'ouvrent que pendant leur semaine (l'admin garde tout)
create or replace function public.mf_race_open() returns boolean
language sql security definer set search_path to 'public' as $$
  select coalesce((select open from public.mf_race_cfg where id = 1), false) and public._casino_on('race') $$;
create or replace function public.mf_coco_open() returns boolean
language sql security definer set search_path to 'public' as $$
  select coalesce((select open from public.mf_coco_cfg where id = 1), false) and public._casino_on('coco') $$;
