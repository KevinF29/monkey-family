-- Monkey Family — L'Expédition (jeu de « greed » entre potes, façon Diamant)
-- À lancer une seule fois dans Supabase. Ne touche à aucune table existante :
-- crée trois tables (mf_exp_cfg, mf_exp_days, mf_exp_players), les fonctions mf_exp_* / _exp_*
-- et une tâche pg_cron « mf-expedition » qui révèle les étapes.
-- Le jeu reste visible par l'admin seulement tant que mf_exp_cfg.open = false.
-- Jeu FIXE du Casino (choix de Kévin le 26/11/2026) : son id 'exp' n'est pas dans mf_casino_cfg.pool.
--
-- Règles (choix de Kévin le 26/11/2026, réglables dans mf_exp_cfg) :
--  - chaque jour, une expédition commune : le serveur mélange un paquet secret de 31 cartes
--    (20 trésors de 2 à 22 🍌, 5 dangers en 2 exemplaires, 1 Idole d'or) ;
--  - gratuit, une expédition par jour ; on peut rejoindre tant que l'expédition est en route ;
--  - une étape par heure, de 10 h à 22 h (13 étapes, heure de Paris) ;
--  - avant chaque étape, chaque joueur encore dedans a un choix secret : continuer ou rentrer au camp
--    (le choix reste tant qu'on ne le change pas ; option « rentrer tout seul dès que mon butin atteint N ») ;
--  - un trésor est partagé à parts égales entre ceux qui sont dedans, le reste reste sur le chemin ;
--    ceux qui rentrent se partagent ce qui traîne sur le chemin ; rentrer SEUL = tout prendre, Idole d'or comprise (1 booster) ;
--  - un 1er danger d'un type ne fait rien ; le 2e du même type : ceux qui sont dedans perdent leur butin,
--    l'expédition s'arrête. Consolation : 1 🍌 par carte passée ;
--  - on ne perd jamais de bananes de sa réserve ;
--  - il faut avoir passé au moins une carte avant de pouvoir rentrer (pas de « je rejoins et je ramasse tout »).
-- Simulation (26/11) avec des joueurs qui rentrent au hasard entre la 3e et la dernière étape :
--  ~28 % des joueurs perdent leur butin, gain moyen ~19 🍌 à 2 joueurs, ~9 🍌 à 6 joueurs, ~0,25 Idole par jour.

create table if not exists public.mf_exp_cfg (
  id int primary key default 1 check (id = 1),
  open boolean not null default false,
  first_hour int not null default 10,     -- heure de la 1re étape (Paris)
  steps int not null default 13,          -- nombre d'étapes (une par heure)
  treasures int[] not null default '{2,2,3,3,4,4,5,6,6,7,8,8,9,10,11,12,14,16,18,22}',
  dangers int not null default 5,         -- types de dangers
  copies int not null default 2,          -- exemplaires de chaque danger
  relics int not null default 1,          -- Idoles d'or dans le paquet
  relic_boost int not null default 1,     -- boosters par Idole
  consol int not null default 1,          -- 🍌 de consolation par carte passée quand on perd
  push boolean not null default true      -- notification à chaque étape pour ceux qui sont dedans
);
alter table public.mf_exp_cfg enable row level security;   -- aucune politique : on passe uniquement par les fonctions
insert into public.mf_exp_cfg(id) values (1) on conflict do nothing;

create table if not exists public.mf_exp_days (
  day date primary key,
  base timestamptz not null,              -- heure de la 1re étape (les suivantes : +1 h chacune)
  deck jsonb not null,                    -- paquet secret : [{k:'t',v}, {k:'d',d}, {k:'r'}]
  step int not null default 0,            -- cartes déjà révélées
  path int not null default 0,            -- 🍌 restées sur le chemin
  relic int not null default 0,           -- Idoles posées sur le chemin
  seen int[] not null default '{}',       -- dangers déjà sortis une fois
  status text not null default 'run',     -- run / dead (2e danger) / done (retour à 22 h)
  cards jsonb not null default '[]'::jsonb,   -- cartes révélées (publiques) avec ce qui s'est passé
  ended_at timestamptz
);
alter table public.mf_exp_days enable row level security;

create table if not exists public.mf_exp_players (
  day date not null,
  uid uuid not null,
  joined int not null default 0,          -- cartes déjà révélées quand le joueur a rejoint
  state text not null default 'in',       -- in / home / lost
  choice text not null default 'go',      -- go / home (pour la prochaine étape)
  auto int not null default 0,            -- rentrer tout seul dès que le butin atteint ce nombre (0 = non)
  loot int not null default 0,            -- butin en cours (perdu si 2e danger)
  gain int not null default 0,            -- 🍌 vraiment gagnées (créditées au retour ou consolation)
  relic int not null default 0,           -- Idoles rapportées
  out_step int,                           -- dernière carte passée au moment du retour / de la perte
  seen boolean not null default false,    -- résultat vu
  at timestamptz not null default now(),
  primary key (day, uid)
);
alter table public.mf_exp_players enable row level security;

create or replace function public._exp_today(p_ts timestamptz default now()) returns date
language sql stable as $$ select (p_ts at time zone 'Europe/Paris')::date $$;

-- crée l'expédition d'un jour (paquet mélangé) si elle n'existe pas encore
create or replace function public._exp_ensure(p_day date)
returns void language plpgsql security definer set search_path = public as $$
declare c public.mf_exp_cfg;
begin
  if exists(select 1 from public.mf_exp_days where day = p_day) then return; end if;
  select * into c from public.mf_exp_cfg where id = 1;
  insert into public.mf_exp_days(day, base, deck)
  select p_day, (p_day::timestamp + make_interval(hours => c.first_hour)) at time zone 'Europe/Paris',
    (select jsonb_agg(x order by random()) from (
      select jsonb_build_object('k', 't', 'v', v) x from unnest(c.treasures) v
      union all select jsonb_build_object('k', 'd', 'd', d) from generate_series(0, c.dangers - 1) d, generate_series(1, c.copies)
      union all select jsonb_build_object('k', 'r') from generate_series(1, c.relics)) z)
  on conflict do nothing;
end $$;

create or replace function public._exp_at(p_day date, p_step int) returns timestamptz
language sql stable security definer set search_path = public as $$
  select base + make_interval(hours => p_step - 1) from public.mf_exp_days where day = p_day $$;

create or replace function public._exp_dname(p int) returns text language sql immutable as $$
  select (array['🐍 Serpent','🕷️ Araignée','🏜️ Sables mouvants','🐆 Panthère','🪨 Éboulement'])[p + 1] $$;

-- crédite un retour au camp (ou une consolation)
create or replace function public._exp_pay(p_uid uuid, p_ban int, p_boost int)
returns void language sql security definer set search_path = public as $$
  update public.pstate set bananas = bananas + greatest(0, p_ban), stock = least(99, stock + greatest(0, p_boost)), updated_at = now()
  where uid = p_uid and (p_ban > 0 or p_boost > 0) $$;

create or replace function public._exp_push(p_uid uuid, p_day date, p_body text)
returns void language sql security definer set search_path = public as $$
  insert into public.mf_push_queue(uid, title, body, tag)
  select p_uid, 'L''Expédition 🌴', p_body, 'exp-' || p_day
  where (select push from public.mf_exp_cfg where id = 1) $$;

-- révèle la prochaine carte d'une expédition
create or replace function public._exp_step(p_day date)
returns void language plpgsql security definer set search_path = public as $$
declare c public.mf_exp_cfg; d public.mf_exp_days; s int; card jsonb; k text; v int := 0; dt int;
  nl int; sh int; rel int; outs jsonb := '[]'::jsonb; n int; fatal boolean := false; p record; ev jsonb; tot int;
begin
  select * into c from public.mf_exp_cfg where id = 1;
  select * into d from public.mf_exp_days where day = p_day for update;
  if d.day is null or d.status <> 'run' or d.step >= c.steps then return; end if;
  s := d.step + 1;
  -- 1) ceux qui rentrent au camp avant la carte (il faut avoir passé au moins une carte)
  select count(*) into nl from public.mf_exp_players
    where day = p_day and state = 'in' and joined < s - 1 and (choice = 'home' or (auto > 0 and loot >= auto));
  if nl > 0 then
    sh := d.path / nl; d.path := d.path - sh * nl;
    rel := case when nl = 1 then d.relic else 0 end; d.relic := d.relic - rel;
    for p in update public.mf_exp_players set state = 'home', out_step = s - 1, gain = loot + sh, loot = loot + sh, relic = rel
        where day = p_day and state = 'in' and joined < s - 1 and (choice = 'home' or (auto > 0 and loot >= auto)) returning * loop
      perform public._exp_pay(p.uid, p.gain, p.relic * c.relic_boost);
      outs := outs || jsonb_build_object('uid', p.uid, 'v', p.gain, 'sh', sh, 'r', p.relic);
      if c.open and (p.gain >= 10 or p.relic > 0) then
        perform public._feed(jsonb_build_object('kind', 'exp_home', 'uid', p.uid, 'v', p.gain, 's', s - 1, 'r', p.relic * c.relic_boost));
      end if;
    end loop;
  end if;
  -- 2) la carte
  card := d.deck -> (s - 1); k := card->>'k';
  select count(*) into n from public.mf_exp_players where day = p_day and state = 'in';
  sh := 0;
  if k = 't' then
    v := (card->>'v')::int;
    if n > 0 then sh := v / n; update public.mf_exp_players set loot = loot + sh where day = p_day and state = 'in'; end if;
    d.path := d.path + v - sh * n;
  elsif k = 'r' then
    d.relic := d.relic + 1;
  else
    dt := (card->>'d')::int;
    if dt = any(d.seen) then fatal := true; else d.seen := d.seen || dt; end if;
  end if;
  ev := jsonb_build_object('s', s, 'k', k, 'n', n, 'sh', sh, 'out', outs, 'at', (extract(epoch from now()) * 1000)::bigint)
    || case when k = 't' then jsonb_build_object('v', v) when k = 'd' then jsonb_build_object('d', dt, 'fatal', fatal) else '{}'::jsonb end;
  d.step := s;
  if fatal then
    tot := 0;
    for p in update public.mf_exp_players set state = 'lost', out_step = s, gain = greatest(0, s - 1 - joined) * c.consol
        where day = p_day and state = 'in' returning * loop
      perform public._exp_pay(p.uid, p.gain, 0);
      tot := tot + p.loot;
      perform public._exp_push(p.uid, p_day, public._exp_dname(dt) || ' ! Encore un… L''expédition s''arrête à l''étape ' || s
        || ' : tu perds ton butin de ' || p.loot || ' 🍌' || case when p.gain > 0 then ' (consolation : +' || p.gain || ' 🍌).' else '.' end);
    end loop;
    ev := ev || jsonb_build_object('lost', (select coalesce(jsonb_agg(jsonb_build_object('uid', uid, 'v', loot)), '[]'::jsonb) from public.mf_exp_players where day = p_day and state = 'lost' and out_step = s));
    d.status := 'dead'; d.ended_at := now();
    if c.open and n > 0 then
      perform public._feed(jsonb_build_object('kind', 'exp_lost', 'us', (select jsonb_agg(uid) from public.mf_exp_players where day = p_day and state = 'lost' and out_step = s),
        'd', dt, 's', s, 'v', tot));
    end if;
  else
    for p in select * from public.mf_exp_players where day = p_day and state = 'in' loop
      perform public._exp_push(p.uid, p_day, 'Étape ' || s || '/' || c.steps || ' : ' ||
        case when k = 't' then 'trésor de ' || v || ' 🍌 (+' || sh || ' pour toi).'
             when k = 'r' then '🗿 une Idole d''or ! Seul celui qui rentre SEUL la ramasse.'
             else public._exp_dname(dt) || ' ! Si un 2e sort, tu perds tout.' end
        || ' Ton butin : ' || p.loot || ' 🍌.' || case when s < c.steps then ' Tu continues ?' else '' end);
    end loop;
    -- 3) dernière étape passée : tout le monde rentre au camp avec ce qui traîne
    if s >= c.steps then
      select count(*) into n from public.mf_exp_players where day = p_day and state = 'in';
      outs := '[]'::jsonb;
      if n > 0 then
        sh := d.path / n; d.path := d.path - sh * n;
        rel := case when n = 1 then d.relic else 0 end; d.relic := d.relic - rel;
        for p in update public.mf_exp_players set state = 'home', out_step = s, loot = loot + sh, gain = loot + sh, relic = rel
            where day = p_day and state = 'in' returning * loop
          perform public._exp_pay(p.uid, p.gain, p.relic * c.relic_boost);
          outs := outs || jsonb_build_object('uid', p.uid, 'v', p.gain, 'sh', sh, 'r', p.relic);
          perform public._exp_push(p.uid, p_day, 'Fin de l''expédition, retour au camp : +' || p.gain || ' 🍌' || case when p.relic > 0 then ' et l''Idole d''or !' else ' !' end);
          if c.open and (p.gain >= 10 or p.relic > 0) then
            perform public._feed(jsonb_build_object('kind', 'exp_home', 'uid', p.uid, 'v', p.gain, 's', s, 'r', p.relic * c.relic_boost, 'end', true));
          end if;
        end loop;
      end if;
      ev := ev || jsonb_build_object('end', outs);
      d.status := 'done'; d.ended_at := now();
    end if;
  end if;
  update public.mf_exp_days set step = d.step, path = d.path, relic = d.relic, seen = d.seen, status = d.status, ended_at = d.ended_at,
    cards = cards || jsonb_build_array(ev) where day = p_day;
end $$;

-- chaque minute (pg_cron) : crée l'expédition du jour et révèle les étapes arrivées à l'heure
create or replace function public._exp_tick()
returns void language plpgsql security definer set search_path = public as $$
declare c public.mf_exp_cfg; r record; guard int := 0;
begin
  if not pg_try_advisory_xact_lock(hashtext('mf_exp_tick')) then return; end if;
  select * into c from public.mf_exp_cfg where id = 1;
  perform public._exp_ensure(public._exp_today());
  for r in select day from public.mf_exp_days where status = 'run' order by day loop
    while guard < 100 and exists(select 1 from public.mf_exp_days d where d.day = r.day and d.status = 'run' and d.step < c.steps
        and now() >= d.base + make_interval(hours => d.step)) loop
      perform public._exp_step(r.day); guard := guard + 1;
    end loop;
  end loop;
end $$;

-- ouvert à tous ? (jeu fixe : _casino_on('exp') est toujours vrai tant que 'exp' n'est pas dans le pool)
create or replace function public.mf_exp_open()
returns boolean language sql security definer set search_path = public as $$
  select coalesce((select open from public.mf_exp_cfg where id = 1), false) and public._casino_on('exp') $$;

-- jour où l'on peut rejoindre : aujourd'hui si l'expédition est en route, sinon demain
create or replace function public._exp_target() returns date
language sql stable security definer set search_path = public as $$
  select case when exists(select 1 from public.mf_exp_days d, public.mf_exp_cfg c where c.id = 1 and d.day = public._exp_today()
    and d.status = 'run' and d.step < c.steps) then public._exp_today() else public._exp_today() + 1 end $$;

create or replace function public._exp_info(p_uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.mf_exp_cfg; t date := public._exp_today(); d public.mf_exp_days; me public.mf_exp_players; tg date := public._exp_target();
  nx public.mf_exp_players; last public.mf_exp_players; ld public.mf_exp_days;
begin
  perform public._exp_ensure(t);
  select * into c from public.mf_exp_cfg where id = 1;
  select * into d from public.mf_exp_days where day = t;
  select * into me from public.mf_exp_players where day = t and uid = p_uid;
  select * into nx from public.mf_exp_players where day = t + 1 and uid = p_uid;
  select pl.* into last from public.mf_exp_players pl join public.mf_exp_days dd on dd.day = pl.day
    where pl.uid = p_uid and pl.state <> 'in' and not pl.seen and dd.status <> 'run' order by pl.day desc limit 1;
  if last.day is not null then select * into ld from public.mf_exp_days where day = last.day; end if;
  return jsonb_build_object(
    'open', coalesce(c.open, false), 'steps', c.steps, 'firstHour', c.first_hour, 'consol', c.consol, 'relicBoost', c.relic_boost,
    'dangers', c.dangers, 'copies', c.copies,
    'day', t, 'status', d.status, 'step', d.step, 'path', d.path, 'relic', d.relic, 'seen', to_jsonb(d.seen), 'cards', d.cards,
    'startAt', (extract(epoch from d.base) * 1000)::bigint,
    'nextAt', case when d.status = 'run' and d.step < c.steps then (extract(epoch from d.base + make_interval(hours => d.step)) * 1000)::bigint end,
    'players', (select coalesce(jsonb_agg(jsonb_build_object('uid', pl.uid, 'name', coalesce(ps.pseudo, '?'), 'state', pl.state,
        'loot', pl.loot, 'gain', pl.gain, 'relic', pl.relic, 'out', pl.out_step, 'joined', pl.joined)
        order by (pl.state = 'in') desc, pl.gain desc, pl.loot desc, pl.at), '[]'::jsonb)
      from public.mf_exp_players pl left join public.pstate ps on ps.uid = pl.uid where pl.day = t),
    'me', case when me.uid is null then null else jsonb_build_object('state', me.state, 'choice', me.choice, 'auto', me.auto, 'loot', me.loot,
      'gain', me.gain, 'relic', me.relic, 'out', me.out_step, 'joined', me.joined, 'canLeave', me.state = 'in' and me.joined < d.step) end,
    'target', tg,
    'next', jsonb_build_object('day', t + 1, 'joined', nx.uid is not null, 'choice', nx.choice, 'auto', nx.auto,
      'n', (select count(*) from public.mf_exp_players where day = t + 1),
      'startAt', (extract(epoch from (((t + 1)::timestamp + make_interval(hours => c.first_hour)) at time zone 'Europe/Paris')) * 1000)::bigint),
    'last', case when last.day is null then null else jsonb_build_object('day', last.day, 'state', last.state, 'gain', last.gain, 'loot', last.loot,
      'relic', last.relic, 'out', last.out_step, 'status', ld.status, 'steps', ld.step,
      'danger', case when ld.status = 'dead' then (ld.cards -> -1 ->> 'd')::int end) end,
    'hist', (select coalesce(jsonb_agg(jsonb_build_object('day', h.day, 'state', h.state, 'gain', h.gain, 'relic', h.relic, 'out', h.out_step) order by h.day desc), '[]'::jsonb)
      from (select * from public.mf_exp_players where uid = p_uid and state <> 'in' order by day desc limit 7) h),
    'me_uid', p_uid,
    'now', (extract(epoch from now()) * 1000)::bigint,
    'state', public._state(p_uid));
end $$;

create or replace function public.mf_exp_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  if not public.mf_exp_open() and not public.is_admin() then raise exception 'exp_closed'; end if;
  return public._exp_info(u);
end $$;

-- rejoindre l'expédition en route (ou celle de demain si celle du jour est finie)
create or replace function public.mf_exp_join()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); tg date; d public.mf_exp_days;
begin
  if not public.mf_exp_open() and not public.is_admin() then raise exception 'exp_closed'; end if;
  perform public._exp_ensure(public._exp_today());
  tg := public._exp_target();
  perform public._exp_ensure(tg);
  select * into d from public.mf_exp_days where day = tg for update;
  if d.status <> 'run' then raise exception 'exp_over'; end if;
  if exists(select 1 from public.mf_exp_players where day = tg and uid = u) then raise exception 'exp_already'; end if;
  insert into public.mf_exp_players(day, uid, joined) values (tg, u, d.step);
  return public._exp_info(u);
end $$;

-- choix secret pour la prochaine étape : 'go' (continuer) ou 'home' (rentrer) ; p_auto = rentrer dès que le butin atteint N (0 = non)
create or replace function public.mf_exp_choose(p_choice text, p_auto int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); n int;
begin
  if p_choice not in ('go', 'home') then raise exception 'exp_bad'; end if;
  update public.mf_exp_players set choice = p_choice, auto = coalesce(least(greatest(p_auto, 0), 999), auto)
    where uid = u and state = 'in' and day in (public._exp_today(), public._exp_today() + 1);
  get diagnostics n = row_count;
  if n = 0 then raise exception 'exp_not_in'; end if;
  return public._exp_info(u);
end $$;

create or replace function public.mf_exp_seen(p_day date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  update public.mf_exp_players set seen = true where uid = u and day <= p_day and state <> 'in';
  return public._exp_info(u);
end $$;

-- admin : 'open' / 'close', 'step' (révéler la prochaine carte tout de suite), 'reset' (nouvelle expédition du jour, 1re étape à l'heure pile suivante),
-- 'bananas' (+50 🍌 pour soi). Les bananes déjà gagnées restent acquises.
create or replace function public.mf_exp_admin(p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); t date := public._exp_today();
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_action = 'step' then
    perform public._exp_step(t);
  elsif p_action = 'reset' then
    delete from public.mf_exp_players where day = t;
    delete from public.mf_exp_days where day = t;
    perform public._exp_ensure(t);
    update public.mf_exp_days set base = greatest(base, date_trunc('hour', now()) + interval '1 hour') where day = t;
  elsif p_action = 'bananas' then
    update public.pstate set bananas = bananas + 50 where uid = u;
  elsif p_action = 'open' then
    update public.mf_exp_cfg set open = true where id = 1;
  elsif p_action = 'close' then
    update public.mf_exp_cfg set open = false where id = 1;
  end if;
  return public._exp_info(u);
end $$;

-- les fonctions internes ne s'appellent pas depuis le site
revoke execute on function public._exp_today(timestamptz), public._exp_ensure(date), public._exp_at(date, int), public._exp_dname(int),
  public._exp_pay(uuid, int, int), public._exp_push(uuid, date, text), public._exp_step(date), public._exp_tick(), public._exp_target(),
  public._exp_info(uuid) from public, anon, authenticated;
revoke execute on function public.mf_exp_open(), public.mf_exp_status(), public.mf_exp_join(), public.mf_exp_choose(text, int),
  public.mf_exp_seen(date), public.mf_exp_admin(text) from public, anon;
grant execute on function public.mf_exp_open(), public.mf_exp_status(), public.mf_exp_join(), public.mf_exp_choose(text, int),
  public.mf_exp_seen(date), public.mf_exp_admin(text) to authenticated;

-- révélation automatique : chaque minute, comme la Monkey Run (mf-course) et le Flying Monkey (mf-flying)
select cron.schedule('mf-expedition', '* * * * *', 'select public._exp_tick()');
