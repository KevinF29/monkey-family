-- =====================================================================
-- Monkey Family — v15 : calendrier de l'Avent + skin hiver de décembre
-- À lancer UNE fois dans Supabase (SQL Editor), juste avant le 1er décembre,
-- en même temps que la mise en ligne du code du calendrier.
-- Ne modifie rien d'existant : ajoute 2 tables, 2 fonctions et un
-- « événement modèle » (inactif) pour le Booster de Noël exclusif du 24.
-- =====================================================================

-- 1) Les cases ouvertes par chaque joueur (une ligne par joueur et par jour)
create table if not exists public.mf_advent_claims (
  uid  uuid not null,
  year int  not null,
  day  int  not null check (day between 1 and 24),
  at   timestamptz not null default now(),
  primary key (uid, year, day)
);
alter table public.mf_advent_claims enable row level security;  -- aucun accès direct : tout passe par les fonctions

-- 2) Réglages : l'événement modèle qui sert de Booster de Noël exclusif
create table if not exists public.mf_advent_cfg (
  year         int primary key,
  xpack_event  bigint not null
);
alter table public.mf_advent_cfg enable row level security;

-- Événement modèle, daté de 2000 : il n'apparaît jamais comme événement actif,
-- il sert seulement de « contenu » au booster exclusif offert le 24.
-- Les 9 cartes de Noël (cadre candy) déjà créées dans le jeu.
do $$
declare eid bigint;
begin
  if not exists (select 1 from public.mf_advent_cfg where year = 2026) then
    insert into public.mf_events (title, kind, starts_at, ends_at, boosters, message, cards, skin, fixed)
    values ('Calendrier de l''Avent — booster du 24 (ne pas supprimer)', 'xpack',
            '2000-01-01', '2000-01-02', 1, '',
            array['c-lutin-beel-graal','c-lutin-chelmaque','c-lutin-dridri','c-lutin-fredho','c-lutin-jamesrr',
                  'c-lutin-sweevy','c-darkkyx-des-neiges','c-pere-kubenoel','c-noel-de-la-monkey-family'],
            'noel', false)
    returning id into eid;
    insert into public.mf_advent_cfg (year, xpack_event) values (2026, eid);
  end if;
end $$;

-- 3) Ce que donne chaque case : ['ban', n] bananes, ['pack', n] boosters,
--    ['xmas', n] n boosters + le Booster de Noël exclusif
create or replace function public._advent_plan()
returns jsonb language sql immutable as $$
  select '{"1":["ban",20],"2":["pack",2],"3":["ban",25],"4":["pack",2],"5":["ban",30],"6":["pack",2],
           "7":["pack",2],"8":["ban",30],"9":["pack",2],"10":["pack",2],"11":["pack",2],"12":["ban",40],
           "13":["pack",2],"14":["pack",2],"15":["ban",40],"16":["pack",3],"17":["ban",50],"18":["pack",2],
           "19":["pack",2],"20":["pack",2],"21":["pack",3],"22":["ban",60],"23":["pack",3],"24":["xmas",5]}'::jsonb
$$;

-- 4) Statut du calendrier pour le joueur connecté (date de Paris décidée par le serveur)
--    active : vrai du 1er au 31 décembre (les cases 1 à 24, rattrapage jusqu'au 31)
--    season : 'hiver' en décembre -> le booster normal prend le skin hiver
create or replace function public._advent_status(p_uid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d date := (now() at time zone 'Europe/Paris')::date;
        on_ boolean := extract(month from d) = 12;
begin
  return jsonb_build_object(
    'active', on_,
    'day', case when on_ then extract(day from d)::int else 0 end,
    'year', extract(year from d)::int,
    'season', case when on_ then 'hiver' else '' end,
    'plan', public._advent_plan(),
    'opened', coalesce((select jsonb_agg(day order by day) from public.mf_advent_claims
                        where uid = p_uid and year = extract(year from d)::int), '[]'::jsonb));
end $$;

create or replace function public.mf_advent_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  return public._advent_status(u);
end $$;

-- 5) Ouvrir une case : aujourd'hui, ou une case passée oubliée (jusqu'au 31 décembre)
create or replace function public.mf_advent_claim(p_day int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
        d date := (now() at time zone 'Europe/Paris')::date;
        y int := extract(year from d)::int;
        r jsonb; k text; n int; eid bigint;
begin
  perform public._ensure(u);
  perform public._tick(u);
  if extract(month from d) <> 12 or p_day is null or p_day < 1 or p_day > 24 or p_day > extract(day from d) then
    raise exception 'locked';
  end if;
  begin
    insert into public.mf_advent_claims (uid, year, day) values (u, y, p_day);
  exception when unique_violation then
    raise exception 'already';
  end;
  r := public._advent_plan() -> p_day::text;
  k := r ->> 0; n := (r ->> 1)::int;
  if k = 'ban' then
    update public.pstate set bananas = bananas + n, updated_at = now() where uid = u;
  else
    update public.pstate set stock = least(99, stock + n), next_at = case when stock + n >= 3 then null else next_at end,
           updated_at = now() where uid = u;
    if k = 'xmas' then
      select xpack_event into eid from public.mf_advent_cfg where year = y;
      if eid is not null then
        update public.pstate set xpacks = xpacks || eid where uid = u;
      end if;
    end if;
  end if;
  return jsonb_build_object('reward', r, 'status', public._advent_status(u), 'state', public._state(u));
end $$;

grant execute on function public.mf_advent_status() to authenticated;
grant execute on function public.mf_advent_claim(int) to authenticated;
revoke execute on function public._advent_status(uuid) from public, anon, authenticated;
