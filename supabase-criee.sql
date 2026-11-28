-- Monkey Family — La Criée aux bananes (enchères secrètes entre potes, façon Raj / Hol's der Geier)
-- À lancer une seule fois dans Supabase. Ne touche à aucune table existante :
-- crée trois tables (mf_cri_cfg, mf_cri_days, mf_cri_players), les fonctions mf_cri_* / _cri_*
-- et une tâche pg_cron « mf-criee » qui fait avancer les enchères.
-- Le jeu reste visible par l'admin seulement tant que mf_cri_cfg.open = false.
-- Jeu de l'Arène, toujours là (son id 'cri' n'est dans aucune liste de rotation).
--
-- Règles (28/11/2026, réglables dans mf_cri_cfg) :
--  - chaque jour, une Criée commune de 15 lots mélangés : 9 lots de bananes (+2 à +18 🍌), 1 booster,
--    5 pertes (-2 à -10 🍌) ; gratuit, il faut s'inscrire chaque jour ;
--  - chaque joueur a 15 cartes numérotées de 1 à 15 ; pour chaque lot, il en mise une en secret, elle est perdue une fois jouée ;
--  - lot positif : la plus haute mise gagne ; perte : la plus BASSE mise la prend ;
--  - les mises identiques s'annulent (on regarde seulement les cartes jouées par un seul joueur) ;
--    si tout s'annule, le lot reste et s'ajoute au suivant (on se bat pour les deux) ;
--  - 1er lot à 10 h s'il y a au moins 2 joueurs (sinon on attend le 2e), puis le lot suivant dès que tout le monde a misé,
--    au plus tard 1 h après : sans mise, le serveur joue une de tes cartes au hasard ;
--  - à la fin, on gagne son score s'il est positif (jamais de perte sur la réserve) et les boosters remportés ;
--  - on peut rejoindre en cours de route : on reçoit autant de cartes qu'il reste de lots (tirées au hasard parmi 1 à 15) ;
--  - l'admin joue en « fantôme », comme dans L'Expédition : sa carte ne gêne personne (les potes sont départagés sans lui),
--    il gagne le lot en bananes (sans booster) seulement si sa carte l'aurait emporté face à tout le monde ;
--    il ne compte pas pour lancer la partie ni pour « tout le monde a misé » ;
--  - à minuit, une Criée encore en cours s'arrête : les lots restants ne sont pas joués.

create table if not exists public.mf_cri_cfg (
  id int primary key default 1 check (id = 1),
  open boolean not null default false,
  first_hour int not null default 10,          -- heure du 1er lot (Paris)
  lots int[] not null default '{2,4,6,8,10,12,14,16,18,-2,-4,-6,-8,-10}',   -- lots de bananes (négatif = perte)
  boosts int not null default 1,               -- lots « 1 booster »
  boost_val int not null default 20,           -- poids d'un booster pour savoir si un lot groupé est positif
  cards int not null default 15,               -- cartes par joueur = nombre de lots
  wait_min int not null default 60,            -- temps max pour miser sur un lot
  min_players int not null default 2,          -- joueurs (hors admin) pour lancer la Criée
  push boolean not null default true
);
alter table public.mf_cri_cfg enable row level security;   -- aucune politique : on passe uniquement par les fonctions
insert into public.mf_cri_cfg(id) values (1) on conflict do nothing;

create table if not exists public.mf_cri_days (
  day date primary key,
  base timestamptz not null,                   -- heure du 1er lot
  deck jsonb not null,                         -- lots mélangés : [{v:int} ou {b:1}]
  step int not null default 0,                 -- lots déjà adjugés (ou annulés)
  open_at timestamptz,                         -- heure où le lot en cours a été dévoilé (null = pas encore)
  pot_v int not null default 0,                -- report des lots dont toutes les mises se sont annulées
  pot_b int not null default 0,
  pot_n int not null default 0,
  status text not null default 'run',          -- run / done
  rounds jsonb not null default '[]'::jsonb,   -- lots joués (publics) avec toutes les mises
  ended_at timestamptz
);
alter table public.mf_cri_days enable row level security;

create table if not exists public.mf_cri_players (
  day date not null,
  uid uuid not null,
  hand int[] not null,                         -- cartes encore en main
  bid int,                                     -- mise secrète pour le lot en cours
  auto boolean not null default false,         -- mise jouée par le serveur (pas de réponse à temps)
  joined int not null default 0,               -- lots déjà joués quand le joueur est arrivé
  score int not null default 0,                -- 🍌 du jour (peut être négatif en cours de partie)
  boost int not null default 0,
  wins int not null default 0,                 -- lots remportés
  gain int not null default 0,                 -- 🍌 vraiment créditées à la fin
  rank int,
  done boolean not null default false,
  seen boolean not null default false,
  nudged int,                                  -- lot pour lequel on l'a relancé
  at timestamptz not null default now(),
  primary key (day, uid)
);
alter table public.mf_cri_players enable row level security;

create or replace function public._cri_today(p_ts timestamptz default now()) returns date
language sql stable as $$ select (p_ts at time zone 'Europe/Paris')::date $$;

create or replace function public._cri_adm(p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$ select exists(select 1 from public.admins where uid = p_uid) $$;

create or replace function public._cri_ensure(p_day date)
returns void language plpgsql security definer set search_path = public as $$
declare c public.mf_cri_cfg;
begin
  if exists(select 1 from public.mf_cri_days where day = p_day) then return; end if;
  select * into c from public.mf_cri_cfg where id = 1;
  insert into public.mf_cri_days(day, base, deck)
  select p_day, (p_day::timestamp + make_interval(hours => c.first_hour)) at time zone 'Europe/Paris',
    (select jsonb_agg(x order by random()) from (
      select jsonb_build_object('v', v) x from unnest(c.lots) v
      union all select jsonb_build_object('b', 1) from generate_series(1, c.boosts)) z)
  on conflict do nothing;
end $$;

-- « +8 🍌 », « -6 🍌 », « 1 booster et +4 🍌 »
create or replace function public._cri_ltxt(p_v int, p_b int) returns text language sql immutable as $$
  select coalesce(nullif(concat_ws(' et ',
    case when p_b > 0 then p_b || ' booster' || case when p_b > 1 then 's' else '' end end,
    case when p_v <> 0 then case when p_v > 0 then '+' else '' end || p_v || ' 🍌' end), ''), 'rien') $$;

create or replace function public._cri_push(p_uid uuid, p_day date, p_body text)
returns void language sql security definer set search_path = public as $$
  insert into public.mf_push_queue(uid, title, body, tag)
  select p_uid, 'La Criée aux bananes 🍌', p_body, 'cri-' || p_day
  where (select push from public.mf_cri_cfg where id = 1) $$;

-- dévoile le lot suivant (p_msg : résultat du lot précédent, ajouté au début de la notification)
create or replace function public._cri_reveal(p_day date, p_msg text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c public.mf_cri_cfg; d public.mf_cri_days; lot jsonb; v int; b int; p record;
begin
  select * into c from public.mf_cri_cfg where id = 1;
  select * into d from public.mf_cri_days where day = p_day for update;
  if d.day is null or d.status <> 'run' or d.step >= c.cards then return; end if;
  lot := d.deck -> d.step;
  v := d.pot_v + coalesce((lot->>'v')::int, 0); b := d.pot_b + coalesce((lot->>'b')::int, 0);
  update public.mf_cri_days set open_at = now() where day = p_day;
  update public.mf_cri_players set bid = null, auto = false where day = p_day;
  for p in select * from public.mf_cri_players where day = p_day loop
    perform public._cri_push(p.uid, p_day, coalesce(p_msg || ' ', '') || 'Lot ' || (d.step + 1) || '/' || c.cards || ' : '
      || public._cri_ltxt(v, b) || case when d.pot_n > 0 then ' (avec le report)' else '' end
      || case when v + b * c.boost_val >= 0 then '. La plus haute mise gagne' else '. La plus BASSE mise prend la perte' end
      || ' : à toi de miser !');
  end loop;
end $$;

-- fin de la Criée : classement, bananes et boosters crédités, notification, fil d'actu
create or replace function public._cri_finish(p_day date)
returns void language plpgsql security definer set search_path = public as $$
declare c public.mf_cri_cfg; d public.mf_cri_days; p record; n int; pod jsonb;
begin
  select * into c from public.mf_cri_cfg where id = 1;
  select * into d from public.mf_cri_days where day = p_day for update;
  if d.day is null or d.status <> 'run' then return; end if;
  update public.mf_cri_players x set rank = r.rk
    from (select uid, rank() over (order by score desc, boost desc) rk from public.mf_cri_players where day = p_day and not public._cri_adm(uid)) r
    where x.day = p_day and x.uid = r.uid;
  select count(*) into n from public.mf_cri_players where day = p_day and not public._cri_adm(uid);
  for p in update public.mf_cri_players x set done = true, gain = greatest(0, x.score), boost = case when public._cri_adm(x.uid) then 0 else x.boost end
      where day = p_day returning * loop
    update public.pstate set bananas = bananas + p.gain, stock = least(99, stock + p.boost), updated_at = now()
      where uid = p.uid and (p.gain > 0 or p.boost > 0);
    perform public._cri_push(p.uid, p_day, 'La Criée est terminée' || case when p.rank is not null then ' : tu finis ' || case when p.rank = 1 then '1er' else p.rank || 'e' end || ' sur ' || n else '' end
      || ' avec ' || p.score || ' 🍌' || case when p.gain > 0 or p.boost > 0 then ' → +' || p.gain || ' 🍌' || case when p.boost > 0 then ' et ' || p.boost || ' booster' || case when p.boost > 1 then 's' else '' end else '' end || ' !' else '.' end);
  end loop;
  update public.mf_cri_days set status = 'done', ended_at = now(), open_at = null where day = p_day;
  if c.open and n > 0 then
    select jsonb_agg(jsonb_build_object('uid', uid, 'v', score, 'b', boost) order by rank, at) into pod
      from (select * from public.mf_cri_players where day = p_day and not public._cri_adm(uid) order by rank, at limit 3) z;
    perform public._feed(jsonb_build_object('kind', 'cri', 'pod', pod, 'n', n));
  end if;
end $$;

-- adjuge le lot en cours (ceux qui n'ont pas misé jouent une carte au hasard), puis dévoile le suivant ou termine
create or replace function public._cri_resolve(p_day date)
returns void language plpgsql security definer set search_path = public as $$
declare c public.mf_cri_cfg; d public.mf_cri_days; lot jsonb; lv int; lb int; v int; b int; pos boolean; s int;
  win int; wuid uuid; awin int; auid uuid; ev jsonb; msg text; bids jsonb; wname text;
begin
  select * into c from public.mf_cri_cfg where id = 1;
  select * into d from public.mf_cri_days where day = p_day for update;
  if d.day is null or d.status <> 'run' or d.open_at is null or d.step >= c.cards then return; end if;
  s := d.step + 1; lot := d.deck -> d.step;
  lv := coalesce((lot->>'v')::int, 0); lb := coalesce((lot->>'b')::int, 0);
  v := d.pot_v + lv; b := d.pot_b + lb; pos := v + b * c.boost_val >= 0;
  -- pas de mise à temps : une carte au hasard
  update public.mf_cri_players x set bid = x.hand[1 + floor(random() * cardinality(x.hand))::int], auto = true
    where day = p_day and bid is null and cardinality(hand) > 0;
  -- les potes, sans l'admin : seules les cartes jouées par un seul joueur comptent
  select z.bid into win from (select bid from public.mf_cri_players where day = p_day and bid is not null and not public._cri_adm(uid)
      group by bid having count(*) = 1) z order by case when pos then -z.bid else z.bid end limit 1;
  if win is not null then
    select uid into wuid from public.mf_cri_players where day = p_day and bid = win and not public._cri_adm(uid);
    update public.mf_cri_players set score = score + v, boost = boost + b, wins = wins + 1 where day = p_day and uid = wuid;
  end if;
  -- l'admin fantôme : gagne les bananes seulement si sa carte l'aurait emporté face à tout le monde
  select z.bid into awin from (select bid from public.mf_cri_players where day = p_day and bid is not null group by bid having count(*) = 1) z
    order by case when pos then -z.bid else z.bid end limit 1;
  if awin is not null then
    select uid into auid from public.mf_cri_players where day = p_day and bid = awin;
    if public._cri_adm(auid) then update public.mf_cri_players set score = score + v, wins = wins + 1 where day = p_day and uid = auid;
    else auid := null; end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('uid', uid, 'c', bid, 'a', auto) order by bid desc), '[]'::jsonb) into bids
    from public.mf_cri_players where day = p_day and bid is not null and not public._cri_adm(uid);
  ev := jsonb_build_object('s', s, 'lv', lv, 'lb', lb, 'v', v, 'b', b, 'pos', pos, 'n', d.pot_n + 1, 'bids', bids,
    'w', wuid, 'wc', win, 'ag', auid is not null, 'agc', (select bid from public.mf_cri_players where day = p_day and public._cri_adm(uid) and bid is not null limit 1),
    'at', (extract(epoch from now()) * 1000)::bigint);
  update public.mf_cri_players set hand = array_remove(hand, bid) where day = p_day and bid is not null;
  if wuid is null then
    update public.mf_cri_days set pot_v = v, pot_b = b, pot_n = pot_n + 1 where day = p_day;
  else
    update public.mf_cri_days set pot_v = 0, pot_b = 0, pot_n = 0 where day = p_day;
  end if;
  update public.mf_cri_days set step = s, open_at = null, rounds = rounds || jsonb_build_array(ev) where day = p_day;
  if wuid is not null then select coalesce(pseudo, '?') into wname from public.pstate where uid = wuid; end if;
  msg := 'Lot ' || s || ' (' || public._cri_ltxt(v, b) || ') : ' || case when wuid is null then 'toutes les mises se sont annulées, il reste en jeu !'
    else coalesce(wname, '?') || ' ' || case when pos then 'l''emporte' else 'se le prend' end || ' avec un ' || win || '.' end;
  if s >= c.cards then
    perform public._cri_finish(p_day);
  else
    perform public._cri_reveal(p_day, msg);
  end if;
end $$;

-- tous les potes (hors admin) ont-ils misé ?
create or replace function public._cri_allbid(p_day date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.mf_cri_players where day = p_day and not public._cri_adm(uid))
    and not exists(select 1 from public.mf_cri_players where day = p_day and not public._cri_adm(uid) and bid is null) $$;

-- fait avancer la Criée si c'est le moment ; verrouille le jour
create or replace function public._cri_advance(p_day date) returns boolean
language plpgsql security definer set search_path = public as $$
declare c public.mf_cri_cfg; d public.mf_cri_days;
begin
  select * into c from public.mf_cri_cfg where id = 1;
  select * into d from public.mf_cri_days where day = p_day for update;
  if d.day is null or d.status <> 'run' or d.step >= c.cards then return false; end if;
  if d.open_at is null then
    if now() >= d.base and (select count(*) from public.mf_cri_players where day = p_day and not public._cri_adm(uid)) >= c.min_players then
      perform public._cri_reveal(p_day); return true;
    end if;
    return false;
  end if;
  if now() >= d.open_at + make_interval(mins => c.wait_min) or public._cri_allbid(p_day) then
    perform public._cri_resolve(p_day); return true;
  end if;
  return false;
end $$;

-- chaque minute (pg_cron)
create or replace function public._cri_tick()
returns void language plpgsql security definer set search_path = public as $$
declare r record; guard int := 0;
begin
  if not pg_try_advisory_xact_lock(hashtext('mf_cri_tick')) then return; end if;
  perform public._cri_ensure(public._cri_today());
  for r in select day from public.mf_cri_days where status = 'run' and day < public._cri_today() loop
    perform public._cri_finish(r.day);   -- minuit : les lots restants ne sont pas joués
  end loop;
  for r in select day from public.mf_cri_days where status = 'run' and day >= public._cri_today() order by day loop
    while guard < 40 and public._cri_advance(r.day) loop guard := guard + 1; end loop;
  end loop;
end $$;

create or replace function public.mf_cri_open()
returns boolean language sql security definer set search_path = public as $$
  select coalesce((select open from public.mf_cri_cfg where id = 1), false) and public._casino_on('cri') $$;

-- jour où l'on peut s'inscrire : aujourd'hui tant que la Criée du jour n'est pas finie, sinon demain
create or replace function public._cri_target() returns date
language sql stable security definer set search_path = public as $$
  select case when exists(select 1 from public.mf_cri_days where day = public._cri_today() and status = 'run')
    then public._cri_today() else public._cri_today() + 1 end $$;

create or replace function public._cri_info(p_uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.mf_cri_cfg; t date := public._cri_today(); d public.mf_cri_days; me public.mf_cri_players; nx public.mf_cri_players;
  last public.mf_cri_players; lot jsonb; lv int := 0; lb int := 0; ghost boolean := public._cri_adm(p_uid);
begin
  perform public._cri_ensure(t);
  select * into c from public.mf_cri_cfg where id = 1;
  select * into d from public.mf_cri_days where day = t;
  select * into me from public.mf_cri_players where day = t and uid = p_uid;
  select * into nx from public.mf_cri_players where day = t + 1 and uid = p_uid;
  select * into last from public.mf_cri_players where uid = p_uid and done and not seen order by day desc limit 1;
  if d.open_at is not null then lot := d.deck -> d.step; lv := coalesce((lot->>'v')::int, 0); lb := coalesce((lot->>'b')::int, 0); end if;
  return jsonb_build_object(
    'open', coalesce(c.open, false), 'cards', c.cards, 'firstHour', c.first_hour, 'waitMin', c.wait_min, 'minPlayers', c.min_players,
    'boostVal', c.boost_val, 'lots', to_jsonb(c.lots), 'boosts', c.boosts,
    'day', t, 'status', d.status, 'step', d.step, 'startAt', (extract(epoch from d.base) * 1000)::bigint,
    'openAt', case when d.open_at is not null then (extract(epoch from d.open_at) * 1000)::bigint end,
    'dueAt', case when d.open_at is not null then (extract(epoch from d.open_at + make_interval(mins => c.wait_min)) * 1000)::bigint end,
    'lot', case when d.open_at is not null then jsonb_build_object('lv', lv, 'lb', lb, 'v', d.pot_v + lv, 'b', d.pot_b + lb,
      'n', d.pot_n + 1, 'pos', d.pot_v + lv + (d.pot_b + lb) * c.boost_val >= 0) end,
    'pot', jsonb_build_object('v', d.pot_v, 'b', d.pot_b, 'n', d.pot_n),
    'rounds', d.rounds,
    'inN', (select count(*) from public.mf_cri_players where day = t and not public._cri_adm(uid)),
    'bidN', (select count(*) from public.mf_cri_players where day = t and not public._cri_adm(uid) and bid is not null),
    'players', (select coalesce(jsonb_agg(jsonb_build_object('uid', pl.uid, 'name', coalesce(ps.pseudo, '?'), 'score', pl.score, 'boost', pl.boost,
        'wins', pl.wins, 'hand', to_jsonb(pl.hand), 'bid', pl.bid is not null, 'rank', pl.rank, 'gain', pl.gain, 'admin', public._cri_adm(pl.uid))
        order by pl.score desc, pl.boost desc, pl.at), '[]'::jsonb)
      from public.mf_cri_players pl left join public.pstate ps on ps.uid = pl.uid where pl.day = t and (pl.uid = p_uid or not public._cri_adm(pl.uid))),
    'me', case when me.uid is null then null else jsonb_build_object('hand', to_jsonb(me.hand), 'bid', me.bid, 'score', me.score, 'boost', me.boost,
      'wins', me.wins, 'gain', me.gain, 'rank', me.rank, 'done', me.done, 'joined', me.joined, 'ghost', ghost) end,
    'target', public._cri_target(),
    'next', jsonb_build_object('day', t + 1, 'joined', nx.uid is not null,
      'n', (select count(*) from public.mf_cri_players where day = t + 1 and not public._cri_adm(uid)),
      'startAt', (extract(epoch from (((t + 1)::timestamp + make_interval(hours => c.first_hour)) at time zone 'Europe/Paris')) * 1000)::bigint),
    'last', case when last.day is null then null else jsonb_build_object('day', last.day, 'rank', last.rank, 'score', last.score, 'gain', last.gain,
      'boost', last.boost, 'wins', last.wins, 'n', (select count(*) from public.mf_cri_players where day = last.day and not public._cri_adm(uid))) end,
    'hist', (select coalesce(jsonb_agg(jsonb_build_object('day', h.day, 'rank', h.rank, 'score', h.score, 'gain', h.gain, 'boost', h.boost) order by h.day desc), '[]'::jsonb)
      from (select * from public.mf_cri_players where uid = p_uid and done order by day desc limit 7) h),
    'me_uid', p_uid,
    'now', (extract(epoch from now()) * 1000)::bigint,
    'state', public._state(p_uid));
end $$;

create or replace function public.mf_cri_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  if not public.mf_cri_open() and not public.is_admin() then raise exception 'cri_closed'; end if;
  return public._cri_info(u);
end $$;

-- s'inscrire à la Criée du jour (même en cours de route) ou à celle de demain
create or replace function public.mf_cri_join()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_cri_cfg; tg date; d public.mf_cri_days;
begin
  if not public.mf_cri_open() and not public.is_admin() then raise exception 'cri_closed'; end if;
  select * into c from public.mf_cri_cfg where id = 1;
  perform public._cri_ensure(public._cri_today());
  tg := public._cri_target();
  perform public._cri_ensure(tg);
  select * into d from public.mf_cri_days where day = tg for update;
  if d.status <> 'run' or d.step >= c.cards then raise exception 'cri_over'; end if;
  if exists(select 1 from public.mf_cri_players where day = tg and uid = u) then raise exception 'cri_already'; end if;
  insert into public.mf_cri_players(day, uid, joined, hand)
  values (tg, u, d.step, (select array_agg(x order by x) from (select x from generate_series(1, c.cards) x order by random() limit c.cards - d.step) z));
  perform public._cri_advance(tg);
  return public._cri_info(u);
end $$;

-- mise secrète sur le lot en cours (on peut changer d'avis tant que le lot n'est pas adjugé)
create or replace function public.mf_cri_bid(p_card int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); t date := public._cri_today(); d public.mf_cri_days; n int; p record; miss int;
begin
  select * into d from public.mf_cri_days where day = t for update;   -- d'abord le jour (même ordre de verrous que _cri_advance)
  if not exists(select 1 from public.mf_cri_players where day = t and uid = u) then raise exception 'cri_not_in'; end if;
  if d.day is null or d.status <> 'run' or d.open_at is null then raise exception 'cri_not_open'; end if;
  update public.mf_cri_players set bid = p_card, auto = false where day = t and uid = u and p_card = any(hand);
  get diagnostics n = row_count;
  if n = 0 then raise exception 'cri_bad'; end if;
  if not public._cri_advance(t) and not public._cri_adm(u) then
    -- un seul pote n'a pas encore misé : on le relance (une fois par lot)
    select count(*) into miss from public.mf_cri_players where day = t and not public._cri_adm(uid) and bid is null;
    if miss = 1 and (select count(*) from public.mf_cri_players where day = t and not public._cri_adm(uid)) > 1 then
      for p in update public.mf_cri_players set nudged = d.step where day = t and not public._cri_adm(uid) and bid is null and coalesce(nudged, -1) <> d.step returning * loop
        perform public._cri_push(p.uid, t, 'Tout le monde a misé sur le lot ' || (d.step + 1) || ', il ne manque plus que toi !');
      end loop;
    end if;
  end if;
  return public._cri_info(u);
end $$;

create or replace function public.mf_cri_seen(p_day date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  update public.mf_cri_players set seen = true where uid = u and day <= p_day and done;
  return public._cri_info(u);
end $$;

-- admin : 'open' / 'close', 'start' (dévoiler le 1er lot tout de suite, même sans 2 joueurs), 'resolve' (adjuger le lot en cours maintenant),
-- 'reset' (nouvelle Criée du jour, 1er lot 1 minute plus tard), 'bananas' (+50 🍌 pour soi). Les gains déjà crédités restent acquis.
create or replace function public.mf_cri_admin(p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); t date := public._cri_today();
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  perform public._cri_ensure(t);
  if p_action = 'start' then
    if (select open_at is null and status = 'run' from public.mf_cri_days where day = t) then perform public._cri_reveal(t); end if;
  elsif p_action = 'resolve' then
    perform public._cri_resolve(t);
  elsif p_action = 'reset' then
    delete from public.mf_cri_players where day = t;
    delete from public.mf_cri_days where day = t;
    perform public._cri_ensure(t);
    update public.mf_cri_days set base = greatest(base, now() + interval '1 minute') where day = t;
  elsif p_action = 'bananas' then
    update public.pstate set bananas = bananas + 50 where uid = u;
  elsif p_action = 'open' then
    update public.mf_cri_cfg set open = true where id = 1;
  elsif p_action = 'close' then
    update public.mf_cri_cfg set open = false where id = 1;
  end if;
  return public._cri_info(u);
end $$;

-- les fonctions internes ne s'appellent pas depuis le site
revoke execute on function public._cri_today(timestamptz), public._cri_adm(uuid), public._cri_ensure(date), public._cri_ltxt(int, int),
  public._cri_push(uuid, date, text), public._cri_reveal(date, text), public._cri_finish(date), public._cri_resolve(date),
  public._cri_allbid(date), public._cri_advance(date), public._cri_tick(), public._cri_target(), public._cri_info(uuid)
  from public, anon, authenticated;
revoke execute on function public.mf_cri_open(), public.mf_cri_status(), public.mf_cri_join(), public.mf_cri_bid(int),
  public.mf_cri_seen(date), public.mf_cri_admin(text) from public, anon;
grant execute on function public.mf_cri_open(), public.mf_cri_status(), public.mf_cri_join(), public.mf_cri_bid(int),
  public.mf_cri_seen(date), public.mf_cri_admin(text) to authenticated;

select cron.schedule('mf-criee', '* * * * *', 'select public._cri_tick()');

-- 28/11/2026 vers 18 h (choix de Kévin) : nouveaux lots gagnants. Le paquet est maintenant décrit par mf_cri_cfg.items :
-- 2 boosters, 1 booster, -2 h d'attente (comme le sablier du Monkey Cash : sur le prochain booster, ou mis de côté si le stock est plein),
-- 25, 20, 18, 16, 14, 12 et 10 🍌 ; les 5 pertes ne changent pas (-2 à -10 🍌). Les colonnes lots / boosts ne servent plus.
-- Sens d'un lot groupé : bananes + 20 par booster + 1 par tranche de 6 min d'attente en moins (2 h = 20) ≥ 0 → positif.
alter table public.mf_cri_cfg add column if not exists items jsonb not null
  default '[{"b":2},{"b":1},{"h":120},{"v":25},{"v":20},{"v":18},{"v":16},{"v":14},{"v":12},{"v":10},{"v":-2},{"v":-4},{"v":-6},{"v":-8},{"v":-10}]'::jsonb;
alter table public.mf_cri_days add column if not exists pot_h int not null default 0;     -- minutes d'attente en moins en report
alter table public.mf_cri_players add column if not exists mins int not null default 0;   -- minutes d'attente en moins gagnées

create or replace function public._cri_ensure(p_day date)
returns void language plpgsql security definer set search_path = public as $$
declare c public.mf_cri_cfg;
begin
  if exists(select 1 from public.mf_cri_days where day = p_day) then return; end if;
  select * into c from public.mf_cri_cfg where id = 1;
  insert into public.mf_cri_days(day, base, deck)
  select p_day, (p_day::timestamp + make_interval(hours => c.first_hour)) at time zone 'Europe/Paris',
    (select jsonb_agg(x order by random()) from jsonb_array_elements(c.items) x)
  on conflict do nothing;
end $$;

-- valeur d'un lot pour savoir s'il est positif
create or replace function public._cri_w(p_v int, p_b int, p_h int) returns int language sql stable security definer set search_path = public as $$
  select p_v + p_b * (select boost_val from public.mf_cri_cfg where id = 1) + p_h / 6 $$;

-- « +25 🍌 », « -6 🍌 », « 2 boosters et +10 🍌 », « -2 h d'attente »
create or replace function public._cri_ltxt(p_v int, p_b int, p_h int) returns text language sql immutable as $$
  select coalesce(nullif(concat_ws(' et ',
    case when p_b > 0 then p_b || ' booster' || case when p_b > 1 then 's' else '' end end,
    case when p_h > 0 then '-' || case when p_h % 60 = 0 then (p_h / 60) || ' h' else p_h || ' min' end || ' d''attente' end,
    case when p_v <> 0 then case when p_v > 0 then '+' else '' end || p_v || ' 🍌' end), ''), 'rien') $$;

create or replace function public._cri_reveal(p_day date, p_msg text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c public.mf_cri_cfg; d public.mf_cri_days; lot jsonb; v int; b int; h int; p record;
begin
  select * into c from public.mf_cri_cfg where id = 1;
  select * into d from public.mf_cri_days where day = p_day for update;
  if d.day is null or d.status <> 'run' or d.step >= c.cards then return; end if;
  lot := d.deck -> d.step;
  v := d.pot_v + coalesce((lot->>'v')::int, 0); b := d.pot_b + coalesce((lot->>'b')::int, 0); h := d.pot_h + coalesce((lot->>'h')::int, 0);
  update public.mf_cri_days set open_at = now() where day = p_day;
  update public.mf_cri_players set bid = null, auto = false where day = p_day;
  for p in select * from public.mf_cri_players where day = p_day loop
    perform public._cri_push(p.uid, p_day, coalesce(p_msg || ' ', '') || 'Lot ' || (d.step + 1) || '/' || c.cards || ' : '
      || public._cri_ltxt(v, b, h) || case when d.pot_n > 0 then ' (avec le report)' else '' end
      || case when public._cri_w(v, b, h) >= 0 then '. La plus haute mise gagne' else '. La plus BASSE mise prend la perte' end
      || ' : à toi de miser !');
  end loop;
end $$;

-- minutes d'attente en moins : sur le prochain booster, ou mises de côté si le stock est plein (comme le sablier du Monkey Cash)
create or replace function public._cri_time(p_uid uuid, p_mins int)
returns void language plpgsql security definer set search_path = public as $$
declare s public.pstate;
begin
  if p_mins <= 0 then return; end if;
  select * into s from public.pstate where uid = p_uid for update;
  if s.next_at is not null and s.stock < 3 then
    update public.pstate set next_at = next_at - make_interval(mins => p_mins) where uid = p_uid;
  else
    update public.pstate set slot_bank = least(1440, slot_bank + p_mins) where uid = p_uid;
  end if;
  perform public._tick(p_uid);
end $$;

create or replace function public._cri_finish(p_day date)
returns void language plpgsql security definer set search_path = public as $$
declare c public.mf_cri_cfg; d public.mf_cri_days; p record; n int; pod jsonb; extra text;
begin
  select * into c from public.mf_cri_cfg where id = 1;
  select * into d from public.mf_cri_days where day = p_day for update;
  if d.day is null or d.status <> 'run' then return; end if;
  update public.mf_cri_players x set rank = r.rk
    from (select uid, rank() over (order by score desc, boost desc, mins desc) rk from public.mf_cri_players where day = p_day and not public._cri_adm(uid)) r
    where x.day = p_day and x.uid = r.uid;
  select count(*) into n from public.mf_cri_players where day = p_day and not public._cri_adm(uid);
  for p in update public.mf_cri_players x set done = true, gain = greatest(0, x.score),
        boost = case when public._cri_adm(x.uid) then 0 else x.boost end, mins = case when public._cri_adm(x.uid) then 0 else x.mins end
      where day = p_day returning * loop
    update public.pstate set bananas = bananas + p.gain, stock = least(99, stock + p.boost), updated_at = now()
      where uid = p.uid and (p.gain > 0 or p.boost > 0);
    perform public._cri_time(p.uid, p.mins);
    extra := concat_ws(' et ', case when p.gain > 0 then '+' || p.gain || ' 🍌' end,
      case when p.boost > 0 then p.boost || ' booster' || case when p.boost > 1 then 's' else '' end end,
      case when p.mins > 0 then public._cri_ltxt(0, 0, p.mins) end);
    perform public._cri_push(p.uid, p_day, 'La Criée est terminée' || case when p.rank is not null then ' : tu finis ' || case when p.rank = 1 then '1er' else p.rank || 'e' end || ' sur ' || n else '' end
      || ' avec ' || p.score || ' 🍌' || case when extra <> '' then ' → ' || extra || ' !' else '.' end);
  end loop;
  update public.mf_cri_days set status = 'done', ended_at = now(), open_at = null where day = p_day;
  if c.open and n > 0 then
    select jsonb_agg(jsonb_build_object('uid', uid, 'v', score, 'b', boost, 'h', mins) order by rank, at) into pod
      from (select * from public.mf_cri_players where day = p_day and not public._cri_adm(uid) order by rank, at limit 3) z;
    perform public._feed(jsonb_build_object('kind', 'cri', 'pod', pod, 'n', n));
  end if;
end $$;

create or replace function public._cri_resolve(p_day date)
returns void language plpgsql security definer set search_path = public as $$
declare c public.mf_cri_cfg; d public.mf_cri_days; lot jsonb; lv int; lb int; lh int; v int; b int; h int; pos boolean; s int;
  win int; wuid uuid; awin int; auid uuid; ev jsonb; msg text; bids jsonb; wname text;
begin
  select * into c from public.mf_cri_cfg where id = 1;
  select * into d from public.mf_cri_days where day = p_day for update;
  if d.day is null or d.status <> 'run' or d.open_at is null or d.step >= c.cards then return; end if;
  s := d.step + 1; lot := d.deck -> d.step;
  lv := coalesce((lot->>'v')::int, 0); lb := coalesce((lot->>'b')::int, 0); lh := coalesce((lot->>'h')::int, 0);
  v := d.pot_v + lv; b := d.pot_b + lb; h := d.pot_h + lh; pos := public._cri_w(v, b, h) >= 0;
  update public.mf_cri_players x set bid = x.hand[1 + floor(random() * cardinality(x.hand))::int], auto = true
    where day = p_day and bid is null and cardinality(hand) > 0;
  select z.bid into win from (select bid from public.mf_cri_players where day = p_day and bid is not null and not public._cri_adm(uid)
      group by bid having count(*) = 1) z order by case when pos then -z.bid else z.bid end limit 1;
  if win is not null then
    select uid into wuid from public.mf_cri_players where day = p_day and bid = win and not public._cri_adm(uid);
    update public.mf_cri_players set score = score + v, boost = boost + b, mins = mins + h, wins = wins + 1 where day = p_day and uid = wuid;
  end if;
  select z.bid into awin from (select bid from public.mf_cri_players where day = p_day and bid is not null group by bid having count(*) = 1) z
    order by case when pos then -z.bid else z.bid end limit 1;
  if awin is not null then
    select uid into auid from public.mf_cri_players where day = p_day and bid = awin;
    if public._cri_adm(auid) then update public.mf_cri_players set score = score + v, wins = wins + 1 where day = p_day and uid = auid;
    else auid := null; end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('uid', uid, 'c', bid, 'a', auto) order by bid desc), '[]'::jsonb) into bids
    from public.mf_cri_players where day = p_day and bid is not null and not public._cri_adm(uid);
  ev := jsonb_build_object('s', s, 'lv', lv, 'lb', lb, 'lh', lh, 'v', v, 'b', b, 'h', h, 'pos', pos, 'n', d.pot_n + 1, 'bids', bids,
    'w', wuid, 'wc', win, 'ag', auid is not null, 'agc', (select bid from public.mf_cri_players where day = p_day and public._cri_adm(uid) and bid is not null limit 1),
    'at', (extract(epoch from now()) * 1000)::bigint);
  update public.mf_cri_players set hand = array_remove(hand, bid) where day = p_day and bid is not null;
  if wuid is null then
    update public.mf_cri_days set pot_v = v, pot_b = b, pot_h = h, pot_n = pot_n + 1 where day = p_day;
  else
    update public.mf_cri_days set pot_v = 0, pot_b = 0, pot_h = 0, pot_n = 0 where day = p_day;
  end if;
  update public.mf_cri_days set step = s, open_at = null, rounds = rounds || jsonb_build_array(ev) where day = p_day;
  if wuid is not null then select coalesce(pseudo, '?') into wname from public.pstate where uid = wuid; end if;
  msg := 'Lot ' || s || ' (' || public._cri_ltxt(v, b, h) || ') : ' || case when wuid is null then 'toutes les mises se sont annulées, il reste en jeu !'
    else coalesce(wname, '?') || ' ' || case when pos then 'l''emporte' else 'se le prend' end || ' avec un ' || win || '.' end;
  if s >= c.cards then
    perform public._cri_finish(p_day);
  else
    perform public._cri_reveal(p_day, msg);
  end if;
end $$;

create or replace function public._cri_info(p_uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.mf_cri_cfg; t date := public._cri_today(); d public.mf_cri_days; me public.mf_cri_players; nx public.mf_cri_players;
  last public.mf_cri_players; lot jsonb; lv int := 0; lb int := 0; lh int := 0; ghost boolean := public._cri_adm(p_uid);
begin
  perform public._cri_ensure(t);
  select * into c from public.mf_cri_cfg where id = 1;
  select * into d from public.mf_cri_days where day = t;
  select * into me from public.mf_cri_players where day = t and uid = p_uid;
  select * into nx from public.mf_cri_players where day = t + 1 and uid = p_uid;
  select * into last from public.mf_cri_players where uid = p_uid and done and not seen order by day desc limit 1;
  if d.open_at is not null then lot := d.deck -> d.step;
    lv := coalesce((lot->>'v')::int, 0); lb := coalesce((lot->>'b')::int, 0); lh := coalesce((lot->>'h')::int, 0); end if;
  return jsonb_build_object(
    'open', coalesce(c.open, false), 'cards', c.cards, 'firstHour', c.first_hour, 'waitMin', c.wait_min, 'minPlayers', c.min_players,
    'items', c.items,
    'day', t, 'status', d.status, 'step', d.step, 'startAt', (extract(epoch from d.base) * 1000)::bigint,
    'openAt', case when d.open_at is not null then (extract(epoch from d.open_at) * 1000)::bigint end,
    'dueAt', case when d.open_at is not null then (extract(epoch from d.open_at + make_interval(mins => c.wait_min)) * 1000)::bigint end,
    'lot', case when d.open_at is not null then jsonb_build_object('lv', lv, 'lb', lb, 'lh', lh, 'v', d.pot_v + lv, 'b', d.pot_b + lb, 'h', d.pot_h + lh,
      'n', d.pot_n + 1, 'pos', public._cri_w(d.pot_v + lv, d.pot_b + lb, d.pot_h + lh) >= 0) end,
    'pot', jsonb_build_object('v', d.pot_v, 'b', d.pot_b, 'h', d.pot_h, 'n', d.pot_n),
    'rounds', d.rounds,
    'inN', (select count(*) from public.mf_cri_players where day = t and not public._cri_adm(uid)),
    'bidN', (select count(*) from public.mf_cri_players where day = t and not public._cri_adm(uid) and bid is not null),
    'players', (select coalesce(jsonb_agg(jsonb_build_object('uid', pl.uid, 'name', coalesce(ps.pseudo, '?'), 'score', pl.score, 'boost', pl.boost, 'mins', pl.mins,
        'wins', pl.wins, 'hand', to_jsonb(pl.hand), 'bid', pl.bid is not null, 'rank', pl.rank, 'gain', pl.gain, 'admin', public._cri_adm(pl.uid))
        order by pl.score desc, pl.boost desc, pl.mins desc, pl.at), '[]'::jsonb)
      from public.mf_cri_players pl left join public.pstate ps on ps.uid = pl.uid where pl.day = t and (pl.uid = p_uid or not public._cri_adm(pl.uid))),
    'me', case when me.uid is null then null else jsonb_build_object('hand', to_jsonb(me.hand), 'bid', me.bid, 'score', me.score, 'boost', me.boost, 'mins', me.mins,
      'wins', me.wins, 'gain', me.gain, 'rank', me.rank, 'done', me.done, 'joined', me.joined, 'ghost', ghost) end,
    'target', public._cri_target(),
    'next', jsonb_build_object('day', t + 1, 'joined', nx.uid is not null,
      'n', (select count(*) from public.mf_cri_players where day = t + 1 and not public._cri_adm(uid)),
      'startAt', (extract(epoch from (((t + 1)::timestamp + make_interval(hours => c.first_hour)) at time zone 'Europe/Paris')) * 1000)::bigint),
    'last', case when last.day is null then null else jsonb_build_object('day', last.day, 'rank', last.rank, 'score', last.score, 'gain', last.gain,
      'boost', last.boost, 'mins', last.mins, 'wins', last.wins, 'n', (select count(*) from public.mf_cri_players where day = last.day and not public._cri_adm(uid))) end,
    'hist', (select coalesce(jsonb_agg(jsonb_build_object('day', h.day, 'rank', h.rank, 'score', h.score, 'gain', h.gain, 'boost', h.boost, 'mins', h.mins) order by h.day desc), '[]'::jsonb)
      from (select * from public.mf_cri_players where uid = p_uid and done order by day desc limit 7) h),
    'me_uid', p_uid,
    'now', (extract(epoch from now()) * 1000)::bigint,
    'state', public._state(p_uid));
end $$;

drop function if exists public._cri_ltxt(int, int);
revoke execute on function public._cri_w(int, int, int), public._cri_ltxt(int, int, int), public._cri_time(uuid, int), public._cri_ensure(date),
  public._cri_reveal(date, text), public._cri_finish(date), public._cri_resolve(date), public._cri_info(uuid) from public, anon, authenticated;

-- la Criée du jour pas encore commencée (sans joueur) est refaite avec les nouveaux lots
delete from public.mf_cri_days d where d.status = 'run' and d.step = 0 and d.open_at is null
  and not exists(select 1 from public.mf_cri_players p where p.day = d.day);
