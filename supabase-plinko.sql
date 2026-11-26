-- Monkey Family — Plinko Banana (plinko du Casino : la bille tête de singe tombe entre les clous)
-- À lancer une seule fois dans Supabase. Ne touche à aucune table existante :
-- crée deux tables (mf_pk, mf_pk_cfg) et les fonctions mf_pk_*.
-- Le jeu reste visible par l'admin seulement tant que mf_pk_cfg.open = false.
--
-- Règles (réglables dans mf_pk_cfg) :
--  - prix fixe de 3 🍌 la bille, 10 billes par jour (heure de Paris)
--  - 10 rangées de clous : à chaque clou la bille part à gauche ou à droite (50/50, tiré par le serveur)
--    → 11 cases en bas, case n° = nombre de rebonds à droite (0 = bord gauche, 10 = bord droit)
--  - lots (mf_pk_cfg.prizes, de gauche à droite) :
--    5 boosters · 20 🍌 · 6 🍌 · 3 🍌 · 2 🍌 · 1 🍌 · 2 🍌 · 3 🍌 · 6 🍌 · 20 🍌 · booster Originel
--  - chances (les deux côtés ensemble) : chaque bord 1 sur 1 024 ; 20 🍌 2 % ; 6 🍌 8,8 % ; 3 🍌 23,4 % (bille remboursée) ; 2 🍌 41 % ; 1 🍌 24,6 %
--  - retour en bananes : ~89,6 % (2,69 🍌 pour 3 🍌), plus les deux bords en boosters

create table if not exists public.mf_pk (
  uid uuid primary key,
  day date,                     -- jour du compteur nb
  nb int not null default 0,    -- billes jouées ce jour-là
  hist jsonb not null default '[]'::jsonb,  -- 10 dernières billes (texte)
  total int not null default 0,
  force int                     -- admin : case imposée pour la prochaine bille
);
alter table public.mf_pk enable row level security;   -- aucune politique : on passe uniquement par les fonctions

create table if not exists public.mf_pk_cfg (
  id int primary key default 1 check (id = 1),
  open boolean not null default false,
  price int not null default 3,
  balls int not null default 10,
  rows_n int not null default 10,
  prizes jsonb not null default '[{"t":"boost","v":5},{"t":"ban","v":20},{"t":"ban","v":6},{"t":"ban","v":3},{"t":"ban","v":2},{"t":"ban","v":1},
    {"t":"ban","v":2},{"t":"ban","v":3},{"t":"ban","v":6},{"t":"ban","v":20},{"t":"rpack","v":"Originel"}]'::jsonb
);
alter table public.mf_pk_cfg enable row level security;
insert into public.mf_pk_cfg(id) values (1) on conflict do nothing;

create or replace function public._pk_lab(p jsonb) returns text language sql immutable as $$
  select case p->>'t' when 'ban' then (p->>'v') || ' 🍌' when 'boost' then (p->>'v') || ' boosters'
    when 'rpack' then 'booster ' || (p->>'v') else '?' end $$;

create or replace function public._pk_info(p_uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.mf_pk_cfg; t public.mf_pk; d date := (now() at time zone 'Europe/Paris')::date;
begin
  select * into c from public.mf_pk_cfg where id = 1;
  select * into t from public.mf_pk where uid = p_uid;
  return jsonb_build_object(
    'open', coalesce(c.open, false), 'price', c.price, 'max', c.balls, 'rows', c.rows_n, 'prizes', c.prizes,
    'left', greatest(0, c.balls - case when t.day = d then t.nb else 0 end),
    'hist', coalesce(t.hist, '[]'::jsonb),
    'force', case when public.is_admin() then t.force end,
    'nextDay', (extract(epoch from ((d + 1)::timestamp at time zone 'Europe/Paris')) * 1000)::bigint,
    'now', (extract(epoch from now()) * 1000)::bigint,
    'state', public._state(p_uid));
end $$;

create or replace function public._pk_log(p_uid uuid, txt text)
returns void language sql security definer set search_path = public as $$
  update public.mf_pk set hist = (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select x from jsonb_array_elements(jsonb_build_array(txt) || hist) with ordinality a(x, o) order by o limit 10) z)
  where uid = p_uid $$;

-- ouvert à tous ? (et dans les jeux de la semaine, si on l'ajoute un jour à la rotation du Casino avec l'id 'pk')
create or replace function public.mf_pk_open()
returns boolean language sql security definer set search_path = public as $$
  select coalesce((select open from public.mf_pk_cfg where id = 1), false) and public._casino_on('pk') $$;

create or replace function public.mf_pk_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  if not public.mf_pk_open() and not public.is_admin() then raise exception 'pk_closed'; end if;
  insert into public.mf_pk(uid) values (u) on conflict do nothing;
  return public._pk_info(u);
end $$;

-- lâcher une bille : paie le prix, tire le chemin, crédite le lot. Renvoie le chemin (0 = gauche, 1 = droite) pour l'animation.
create or replace function public.mf_pk_drop()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_pk_cfg; t public.mf_pk; s public.pstate; d date := (now() at time zone 'Europe/Paris')::date;
  played int; adm boolean := public.is_admin(); v_path int[]; v_slot int; i int; p jsonb; v_t text; v_v text;
begin
  if not public.mf_pk_open() and not adm then raise exception 'pk_closed'; end if;
  insert into public.mf_pk(uid) values (u) on conflict do nothing;
  select * into t from public.mf_pk where uid = u for update;
  select * into c from public.mf_pk_cfg where id = 1;
  played := case when t.day = d then t.nb else 0 end;
  if played >= c.balls then raise exception 'pk_limit'; end if;
  select * into s from public.pstate where uid = u for update;
  if s.bananas < c.price then raise exception 'no_bananas'; end if;
  update public.pstate set bananas = bananas - c.price where uid = u;
  update public.mf_pk set day = d, nb = played + 1, total = total + 1, force = null where uid = u;

  if adm and t.force between 0 and c.rows_n then
    -- chemin au hasard qui arrive dans la case imposée : t.force rebonds à droite, dans le désordre
    select array_agg(x order by random()) into v_path
      from (select case when g <= t.force then 1 else 0 end x from generate_series(1, c.rows_n) g) z;
  else
    select array_agg(case when random() < 0.5 then 0 else 1 end) into v_path from generate_series(1, c.rows_n);
  end if;
  v_slot := 0; for i in 1..c.rows_n loop v_slot := v_slot + v_path[i]; end loop;

  p := c.prizes->v_slot; v_t := p->>'t'; v_v := p->>'v';
  if v_t = 'ban' then
    update public.pstate set bananas = bananas + v_v::int where uid = u;
  elsif v_t = 'boost' then
    update public.pstate set stock = least(99, stock + v_v::int), updated_at = now() where uid = u;
  elsif v_t = 'rpack' then
    perform public._give_rpack(u, v_v);
  end if;

  perform public._pk_log(u, 'Case ' || (v_slot + 1) || ' · ' || public._pk_lab(p) ||
    case when v_t = 'ban' and v_v::int > c.price then ' · +' || (v_v::int - c.price) || ' 🍌' else '' end);
  if v_t in ('boost', 'rpack') and not adm then   -- les bords : annoncés dans le fil
    perform public._feed(jsonb_build_object('kind', 'pk', 'uid', u, 'r', v_t, 'v', v_v));
  end if;

  return jsonb_build_object('path', to_jsonb(v_path), 'slot', v_slot, 'prize', p, 'price', c.price, 'info', public._pk_info(u));
end $$;

-- admin : 'reset' (rend les billes du jour), 'bananas' (+50 🍌 pour soi), 'open' / 'close', 'force:N' (case N de 0 à 10 pour la prochaine bille), 'force:' (annule)
create or replace function public.mf_pk_admin(p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  insert into public.mf_pk(uid) values (u) on conflict do nothing;
  if p_action = 'reset' then
    update public.mf_pk set nb = 0 where uid = u;
  elsif p_action = 'bananas' then
    update public.pstate set bananas = bananas + 50 where uid = u;
  elsif p_action = 'open' then
    update public.mf_pk_cfg set open = true where id = 1;
  elsif p_action = 'close' then
    update public.mf_pk_cfg set open = false where id = 1;
  elsif p_action like 'force:%' then
    update public.mf_pk set force = nullif(substr(p_action, 7), '')::int where uid = u;
  end if;
  return public._pk_info(u);
end $$;

-- les fonctions internes ne s'appellent pas depuis le site
revoke execute on function public._pk_lab(jsonb), public._pk_info(uuid), public._pk_log(uuid, text) from public, anon, authenticated;
revoke execute on function public.mf_pk_open(), public.mf_pk_status(), public.mf_pk_drop(), public.mf_pk_admin(text) from public, anon;
grant execute on function public.mf_pk_open(), public.mf_pk_status(), public.mf_pk_drop(), public.mf_pk_admin(text) to authenticated;
