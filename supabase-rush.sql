-- Monkey Family — Monkey Rush (le singe aventurier qui fuit le temple, façon Temple Run)
-- À lancer une seule fois dans Supabase. Ne touche à aucune table existante :
-- crée quatre tables (mf_rush, mf_rush_cfg, mf_rush_scores, mf_rush_rounds), les fonctions mf_rush_* / _rush_*
-- et une tâche pg_cron « mf-rush » qui règle le classement chaque soir.
-- Le jeu reste visible par l'admin seulement tant que mf_rush_cfg.open = false (et il n'est pas dans la rotation du Casino).
--
-- Règles (choix de Kévin le 26/11/2026 : « comme Flying Monkey », réglables dans mf_rush_cfg) :
--  - une MANCHE va de 18 h à 18 h (heure de Paris) ; les courses repartent à zéro à 18 h
--  - 5 courses par manche : la 1re est gratuite, les suivantes coûtent 1 🍌
--  - le score d'une course = mètres parcourus + 5 points par banane ; on garde la meilleure course de la manche
--  - à 18 h (+ 2 min), classement et récompenses : 1er 1 booster + 20 🍌 · 2e 15 · 3e 10 · 4e 5 · 5e 3 · 6e 1 · après : rien
--    (égalité : le premier à avoir fait ce score passe devant)
--  - chaque course reçoit un jeton à usage unique ; un score impossible pour la durée réelle de la course est refusé.
-- (Code repris de supabase-flying.sql : les colonnes gardent les noms « flights » / « vols » côté serveur.)

create table if not exists public.mf_rush_cfg (
  id int primary key default 1 check (id = 1),
  open boolean not null default false,
  price int not null default 1,          -- prix d'une course payante
  free int not null default 1,           -- courses gratuites par manche
  flights int not null default 5,        -- courses par manche (gratuites comprises)
  rewards jsonb not null default '[{"ban":20,"boost":1},{"ban":15},{"ban":10},{"ban":5},{"ban":3},{"ban":1}]'::jsonb,
  admin_ranked boolean not null default false,   -- l'admin ne compte pas dans le classement (choix de Kévin, 27/11)   -- l'admin joue dans le classement comme les autres
  grace_s int not null default 120       -- secondes après 18 h avant de régler la manche
);
alter table public.mf_rush_cfg enable row level security;   -- aucune politique : on passe uniquement par les fonctions
insert into public.mf_rush_cfg(id) values (1) on conflict do nothing;

create table if not exists public.mf_rush (
  uid uuid primary key,
  round date,                     -- manche du compteur nb
  nb int not null default 0,      -- courses lancées dans cette manche
  token uuid,                     -- course en cours (jeton à usage unique)
  t_round date,                   -- manche de la course en cours
  started_at timestamptz,
  best_all int not null default 0,
  total int not null default 0,
  seen date,                      -- dernière manche dont le joueur a vu le résultat
  hist jsonb not null default '[]'::jsonb
);
alter table public.mf_rush enable row level security;

create table if not exists public.mf_rush_scores (
  round date not null,
  uid uuid not null,
  best int not null default 0,
  at timestamptz not null default now(),   -- quand ce meilleur score a été fait (départage les égalités)
  flights int not null default 0,
  primary key (round, uid)
);
alter table public.mf_rush_scores enable row level security;

create table if not exists public.mf_rush_rounds (
  round date primary key,
  settled_at timestamptz not null default now(),
  result jsonb not null default '[]'::jsonb   -- [{uid, best, rank, ban, boost}] dans l'ordre du classement
);
alter table public.mf_rush_rounds enable row level security;

-- manche en cours à un instant donné : avant 18 h c'est la manche du jour, après c'est celle du lendemain
create or replace function public._rush_round(p_ts timestamptz default now()) returns date
language sql stable as $$
  select case when (p_ts at time zone 'Europe/Paris')::time < time '18:00'
    then (p_ts at time zone 'Europe/Paris')::date else (p_ts at time zone 'Europe/Paris')::date + 1 end $$;

-- fin d'une manche (18 h, heure de Paris)
create or replace function public._rush_end(p_round date) returns timestamptz
language sql stable as $$ select (p_round::timestamp + interval '18 hours') at time zone 'Europe/Paris' $$;

create or replace function public._rush_reward(p_rank int) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select rewards->(p_rank - 1) from public.mf_rush_cfg where id = 1), '{}'::jsonb) $$;

-- classement d'une manche (en direct ou réglée) avec les pseudos et la récompense de chaque place
create or replace function public._rush_board(p_round date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c public.mf_rush_cfg; r public.mf_rush_rounds;
begin
  select * into r from public.mf_rush_rounds where round = p_round;
  if r.round is not null then
    return (select coalesce(jsonb_agg(x || jsonb_build_object('name', coalesce(p.pseudo, '?')) order by (x->>'rank')::int), '[]'::jsonb)
      from jsonb_array_elements(r.result) x left join public.pstate p on p.uid = (x->>'uid')::uuid);
  end if;
  select * into c from public.mf_rush_cfg where id = 1;
  return (select coalesce(jsonb_agg(jsonb_build_object('uid', s.uid, 'name', coalesce(p.pseudo, '?'), 'best', s.best, 'rank', s.rk,
      'ban', coalesce((public._rush_reward(s.rk::int)->>'ban')::int, 0), 'boost', coalesce((public._rush_reward(s.rk::int)->>'boost')::int, 0)) order by s.rk), '[]'::jsonb)
    from (select sc.*, row_number() over (order by sc.best desc, sc.at) rk from public.mf_rush_scores sc
          where sc.round = p_round and (c.admin_ranked or not exists(select 1 from public.admins a where a.uid = sc.uid))) s
    left join public.pstate p on p.uid = s.uid);
end $$;

create or replace function public._rush_info(p_uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.mf_rush_cfg; t public.mf_rush; r date := public._rush_round(); played int; lr public.mf_rush_rounds; mine jsonb;
begin
  select * into c from public.mf_rush_cfg where id = 1;
  select * into t from public.mf_rush where uid = p_uid;
  played := case when t.round = r then t.nb else 0 end;
  -- dernière manche réglée où le joueur a couru
  select * into lr from public.mf_rush_rounds fr where fr.round < r and exists(select 1 from jsonb_array_elements(fr.result) x where x->>'uid' = p_uid::text)
    order by fr.round desc limit 1;
  if lr.round is not null then
    select x into mine from jsonb_array_elements(lr.result) x where x->>'uid' = p_uid::text;
  end if;
  return jsonb_build_object(
    'open', coalesce(c.open, false), 'price', c.price, 'free', c.free, 'max', c.flights, 'rewards', c.rewards,
    'played', played, 'left', greatest(0, c.flights - played),
    'freeLeft', greatest(0, c.free - played),
    'round', r, 'endsAt', (extract(epoch from public._rush_end(r)) * 1000)::bigint,
    'myBest', coalesce((select best from public.mf_rush_scores where round = r and uid = p_uid), null),
    'bestAll', coalesce(t.best_all, 0),
    'board', public._rush_board(r),
    'last', case when lr.round is null then null else jsonb_build_object('round', lr.round, 'me', mine, 'seen', t.seen is not null and t.seen >= lr.round,
      'board', public._rush_board(lr.round)) end,
    'hist', coalesce(t.hist, '[]'::jsonb),
    'me', p_uid,
    'now', (extract(epoch from now()) * 1000)::bigint,
    'state', public._state(p_uid));
end $$;

create or replace function public._rush_log(p_uid uuid, txt text)
returns void language sql security definer set search_path = public as $$
  update public.mf_rush set hist = (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select x from jsonb_array_elements(jsonb_build_array(txt) || hist) with ordinality a(x, o) order by o limit 10) z)
  where uid = p_uid $$;

-- ouvert à tous ? (et dans les jeux de la semaine : id 'rush' dans la rotation du Casino)
create or replace function public.mf_rush_open()
returns boolean language sql security definer set search_path = public as $$
  select coalesce((select open from public.mf_rush_cfg where id = 1), false) and public._casino_on('rush') $$;

-- règle les manches terminées : classement, récompenses, annonce dans le fil (appelée chaque minute par pg_cron)
create or replace function public._rush_settle()
returns void language plpgsql security definer set search_path = public as $$
declare c public.mf_rush_cfg; d date; res jsonb; x jsonb; pod jsonb;
begin
  select * into c from public.mf_rush_cfg where id = 1;
  for d in select distinct sc.round from public.mf_rush_scores sc
      where not exists(select 1 from public.mf_rush_rounds fr where fr.round = sc.round)
        and public._rush_end(sc.round) + make_interval(secs => c.grace_s) <= now()
      order by 1 loop
    if not pg_try_advisory_xact_lock(hashtext('mf_rush_settle'), (d - date '2026-01-01')) then continue; end if;
    if exists(select 1 from public.mf_rush_rounds where round = d) then continue; end if;
    res := (select coalesce(jsonb_agg(b - 'name' order by (b->>'rank')::int), '[]'::jsonb) from jsonb_array_elements(public._rush_board(d)) b);
    insert into public.mf_rush_rounds(round, result) values (d, res);
    for x in select * from jsonb_array_elements(res) loop
      if coalesce((x->>'ban')::int, 0) > 0 or coalesce((x->>'boost')::int, 0) > 0 then
        update public.pstate set bananas = bananas + coalesce((x->>'ban')::int, 0),
          stock = least(99, stock + coalesce((x->>'boost')::int, 0)), updated_at = now()
          where uid = (x->>'uid')::uuid;
      end if;
    end loop;
    if c.open and jsonb_array_length(res) > 0 then
      pod := (select jsonb_agg(jsonb_build_object('uid', y->>'uid', 'v', (y->>'best')::int, 'ban', (y->>'ban')::int, 'boost', (y->>'boost')::int))
        from (select y from jsonb_array_elements(res) y limit 3) z);
      -- pas de 'uid' en haut : l'annonce du podium paraît même si l'admin en fait partie
      perform public._feed(jsonb_build_object('kind', 'rush', 'pod', pod, 'n', jsonb_array_length(res)));
    end if;
  end loop;
end $$;

create or replace function public.mf_rush_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  if not public.mf_rush_open() and not public.is_admin() then raise exception 'rush_closed'; end if;
  insert into public.mf_rush(uid) values (u) on conflict do nothing;
  return public._rush_info(u);
end $$;

-- partir : 1re course de la manche gratuite, puis 1 🍌 ; renvoie un jeton à rendre avec le score
create or replace function public.mf_rush_start()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_rush_cfg; t public.mf_rush; s public.pstate; r date := public._rush_round();
  played int; cost int; tk uuid := gen_random_uuid();
begin
  if not public.mf_rush_open() and not public.is_admin() then raise exception 'rush_closed'; end if;
  insert into public.mf_rush(uid) values (u) on conflict do nothing;
  select * into t from public.mf_rush where uid = u for update;
  select * into c from public.mf_rush_cfg where id = 1;
  played := case when t.round = r then t.nb else 0 end;
  if played >= c.flights then raise exception 'rush_limit'; end if;
  cost := case when played < c.free then 0 else c.price end;
  if cost > 0 then
    select * into s from public.pstate where uid = u for update;
    if s.bananas < cost then raise exception 'no_bananas'; end if;
    update public.pstate set bananas = bananas - cost where uid = u;
  end if;
  update public.mf_rush set round = r, nb = played + 1, total = total + 1, token = tk, t_round = r, started_at = now() where uid = u;
  return jsonb_build_object('token', tk, 'cost', cost, 'info', public._rush_info(u));
end $$;

-- arrivée : rend le jeton et le score. Le score compte pour la manche où la course a commencé.
create or replace function public.mf_rush_end(p_token uuid, p_score int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); t public.mf_rush; el numeric; mx int; sc int := greatest(0, coalesce(p_score, 0));
  old int; counted boolean := true; why text := null; nb_ boolean := false; rk int;
begin
  select * into t from public.mf_rush where uid = u for update;
  if t.uid is null or t.token is null or t.token <> p_token then raise exception 'rush_token'; end if;
  el := extract(epoch from now() - t.started_at);
  update public.mf_rush set token = null where uid = u;
  -- plafond : la distance la plus longue possible en el secondes (10 m/s, +1 m/s tous les 90 m jusqu'à 20 m/s,
  -- puis +1 m/s tous les 300 m sans limite), 1 point par mètre + 5 par banane (au plus une tous les 1,9 m), marge 15 %
  mx := least(2000000000, floor(1.15 * (case when el <= 62.383 then 900 * (exp(el / 90) - 1) else 900 + 6000 * (exp(least(el - 62.383, 3600) / 300) - 1) end)
        * (1 + 5 / 1.9)) + 100)::int;
  if el > 3600 or sc > mx or sc > 100000000 then
    counted := false; why := 'rush_bad';
    perform public._rush_log(u, 'Course refusée : ' || sc || ' points en ' || round(el) || ' s');
    return jsonb_build_object('score', sc, 'counted', false, 'why', why, 'info', public._rush_info(u));
  end if;
  if exists(select 1 from public.mf_rush_rounds where round = t.t_round) then
    counted := false; why := 'rush_late';   -- la manche a déjà été réglée
  else
    select best into old from public.mf_rush_scores where round = t.t_round and uid = u;
    insert into public.mf_rush_scores(round, uid, best, at, flights) values (t.t_round, u, sc, now(), 1)
      on conflict (round, uid) do update set flights = mf_rush_scores.flights + 1,
        best = greatest(mf_rush_scores.best, excluded.best),
        at = case when excluded.best > mf_rush_scores.best then now() else mf_rush_scores.at end;
    nb_ := old is null or sc > old;
  end if;
  update public.mf_rush set best_all = greatest(best_all, sc) where uid = u;
  perform public._rush_log(u, sc || ' point' || case when sc > 1 then 's' else '' end || case when nb_ and counted then ' · meilleure course de la manche' else '' end);
  select (b->>'rank')::int into rk from jsonb_array_elements(public._rush_board(t.t_round)) b where b->>'uid' = u::text;
  return jsonb_build_object('score', sc, 'counted', counted, 'why', why, 'newBest', nb_, 'rank', rk, 'info', public._rush_info(u));
end $$;

-- le joueur a vu le résultat de la manche p_round (la fenêtre « Résultat d'hier » ne revient plus)
create or replace function public.mf_rush_seen(p_round date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  update public.mf_rush set seen = greatest(coalesce(seen, p_round), p_round) where uid = u;
  return public._rush_info(u);
end $$;

-- admin : 'open' / 'close', 'reset' (rend ses courses de la manche), 'bananas' (+50 🍌 pour soi)
create or replace function public.mf_rush_admin(p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  insert into public.mf_rush(uid) values (u) on conflict do nothing;
  if p_action = 'reset' then
    update public.mf_rush set nb = 0 where uid = u;
  elsif p_action = 'bananas' then
    update public.pstate set bananas = bananas + 50 where uid = u;
  elsif p_action = 'open' then
    update public.mf_rush_cfg set open = true where id = 1;
  elsif p_action = 'close' then
    update public.mf_rush_cfg set open = false where id = 1;
  end if;
  return public._rush_info(u);
end $$;

-- les fonctions internes ne s'appellent pas depuis le site
revoke execute on function public._rush_round(timestamptz), public._rush_end(date), public._rush_reward(int), public._rush_board(date),
  public._rush_info(uuid), public._rush_log(uuid, text), public._rush_settle() from public, anon, authenticated;
revoke execute on function public.mf_rush_open(), public.mf_rush_status(), public.mf_rush_start(), public.mf_rush_end(uuid, int),
  public.mf_rush_seen(date), public.mf_rush_admin(text) from public, anon;
grant execute on function public.mf_rush_open(), public.mf_rush_status(), public.mf_rush_start(), public.mf_rush_end(uuid, int),
  public.mf_rush_seen(date), public.mf_rush_admin(text) to authenticated;

-- règlement automatique : chaque minute, comme la Monkey Run (mf-course)
select cron.schedule('mf-rush', '* * * * *', 'select public._rush_settle()');

