-- Monkey Family — Le Cocotier (jeu « crash »)
-- À lancer une seule fois dans Supabase (SQL Editor). Ne touche à aucune table existante :
-- crée deux tables (mf_coco, mf_coco_cfg) et les fonctions mf_coco_*.
-- Le jeu reste visible par l'admin seulement tant que mf_coco_cfg.open = false
-- (bouton « Ouvrir à tous » dans les réglages admin du jeu).
--
-- Règles :
--  - le joueur mise (1 à 10 🍌 au départ), le singe grimpe et le multiplicateur monte : m(t) = exp(speed × t)
--  - le point de chute est tiré au départ, ici, côté serveur, et n'est jamais envoyé avant la fin de la partie
--  - « Encaisser » avant la chute = mise × multiplicateur ; sinon la mise est perdue
--  - le singe qui atteint le sommet (cap, ×25 au départ) encaisse tout seul au plafond
--  - chances : P(le singe dépasse ×m) = rtp / m (rtp = 0,92 au départ : 8 % de chute immédiate à ×1,00)
--  - parties limitées par jour (heure de Paris)

create table if not exists public.mf_coco (
  uid uuid primary key,
  day date,                    -- jour du compteur n
  n int not null default 0,    -- parties jouées ce jour-là
  total int not null default 0,
  round jsonb,                 -- partie en cours : id, bet, start (ms), crash (jamais renvoyé avant la fin)
  last jsonb                   -- dernière partie terminée (pour l'écran de fin)
);
alter table public.mf_coco enable row level security;   -- aucune politique : on passe uniquement par les fonctions

create table if not exists public.mf_coco_cfg (
  id int primary key default 1 check (id = 1),
  open boolean not null default false,
  bet_min int not null default 1,
  bet_max int not null default 10,
  daily int not null default 10,
  cap numeric not null default 25,
  rtp numeric not null default 0.92,
  speed numeric not null default 0.12   -- ×2 vers 6 s, ×5 vers 13 s, ×10 vers 19 s, ×25 vers 27 s
);
alter table public.mf_coco_cfg enable row level security;
insert into public.mf_coco_cfg(id) values (1) on conflict do nothing;

-- délai entre le clic sur « Grimper » et le départ du singe (le temps que la réponse arrive sur le téléphone)
create or replace function public._coco_lead() returns int language sql immutable as $$ select 1500 $$;

-- tirage du point de chute, arrondi au centième en dessous, plafonné au sommet
create or replace function public._coco_draw(p_rtp numeric, p_cap numeric)
returns numeric language plpgsql set search_path = public as $$
declare x numeric := p_rtp / (1 - random()::numeric);
begin
  if x < 1 then x := 1; end if;
  return least(p_cap, floor(x * 100) / 100);
end $$;

-- multiplicateur au bout de ms millisecondes de grimpe
create or replace function public._coco_mult(p_ms numeric, p_speed numeric)
returns numeric language sql immutable as $$ select floor(exp(p_speed * greatest(0, p_ms) / 1000) * 100) / 100 $$;

-- moment (ms depuis le départ) où le multiplicateur atteint m
create or replace function public._coco_at(p_m numeric, p_speed numeric)
returns numeric language sql immutable as $$ select ln(greatest(1, p_m)) / p_speed * 1000 $$;

create or replace function public._coco_now() returns bigint language sql stable as $$ select (extract(epoch from clock_timestamp()) * 1000)::bigint $$;

-- fin de partie : gain, compteur, fil d'actu. p_cash = multiplicateur encaissé (null = le singe est tombé)
create or replace function public._coco_end(p_uid uuid, p_cash numeric)
returns void language plpgsql security definer set search_path = public as $$
declare t public.mf_coco; c public.mf_coco_cfg; r jsonb; bet int; crash numeric; top boolean; gain int := 0;
begin
  select * into t from public.mf_coco where uid = p_uid for update;
  if t.round is null then return; end if;
  select * into c from public.mf_coco_cfg where id = 1;
  r := t.round; bet := (r->>'bet')::int; crash := (r->>'crash')::numeric;
  top := p_cash is not null and p_cash >= c.cap;
  if p_cash is not null then
    gain := floor(bet * p_cash)::int;
    update public.pstate set bananas = bananas + gain where uid = p_uid;
  end if;
  update public.mf_coco set round = null,
    last = jsonb_build_object('id', r->'id', 'bet', bet, 'crash', crash, 'cash', p_cash, 'gain', gain, 'top', top, 'start', r->'start')
  where uid = p_uid;
  -- annonces : le sommet, un gros encaissement (×10 et plus), ou le « j'aurais dû » (lâché bas, le singe est monté très haut)
  if top or (p_cash is not null and (p_cash >= 10 or (crash >= 10 and crash >= p_cash * 4))) then
    perform public._feed(jsonb_build_object('kind', 'coco', 'uid', p_uid, 'm', p_cash, 'c', crash, 'v', gain, 'b', bet, 'top', top));
  end if;
end $$;

-- la partie en cours est-elle finie (singe tombé, ou arrivé au sommet) ? on la clôt
create or replace function public._coco_settle(p_uid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t public.mf_coco; c public.mf_coco_cfg; crash numeric;
begin
  select * into t from public.mf_coco where uid = p_uid;
  if t.round is null then return; end if;
  select * into c from public.mf_coco_cfg where id = 1;
  crash := (t.round->>'crash')::numeric;
  if public._coco_now() >= (t.round->>'start')::bigint + public._coco_at(crash, c.speed) then
    perform public._coco_end(p_uid, case when crash >= c.cap then c.cap else null end);
  end if;
end $$;

create or replace function public._coco_info(p_uid uuid, p_full boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.mf_coco_cfg; t public.mf_coco; d date := (now() at time zone 'Europe/Paris')::date;
begin
  select * into c from public.mf_coco_cfg where id = 1;
  select * into t from public.mf_coco where uid = p_uid;
  return jsonb_build_object(
    'open', coalesce(c.open, false), 'min', c.bet_min, 'max', c.bet_max, 'daily', c.daily,
    'cap', c.cap, 'rtp', c.rtp, 'speed', c.speed,
    'left', greatest(0, c.daily - case when t.day = d then t.n else 0 end),
    'round', case when t.round is null then null else t.round - 'crash' end,   -- le point de chute reste secret
    'last', t.last,
    'now', public._coco_now(),
    'nextDay', (extract(epoch from ((d + 1)::timestamp at time zone 'Europe/Paris')) * 1000)::bigint)
    || case when p_full then jsonb_build_object('state', public._state(p_uid)) else '{}'::jsonb end;
end $$;

-- le jeu est-il visible pour tous ?
create or replace function public.mf_coco_open()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select open from public.mf_coco_cfg where id = 1), false) $$;

create or replace function public.mf_coco_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  perform public._tick(u);
  perform public._coco_settle(u);
  return public._coco_info(u);
end $$;

-- lancer une partie. p_force (admin seulement) : point de chute imposé (1 à cap)
create or replace function public.mf_coco_start(p_bet int, p_force numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_coco_cfg; t public.mf_coco; s public.pstate;
  d date := (now() at time zone 'Europe/Paris')::date; v_n int; crash numeric;
begin
  select * into c from public.mf_coco_cfg where id = 1;
  if not coalesce(c.open, false) and not public.is_admin() then raise exception 'coco_closed'; end if;
  insert into public.mf_coco(uid) values (u) on conflict do nothing;
  perform public._coco_settle(u);
  select * into t from public.mf_coco where uid = u for update;
  if t.round is not null then return public._coco_info(u); end if;   -- une partie tourne déjà : on la redonne
  if p_bet is null or p_bet < c.bet_min or p_bet > c.bet_max then raise exception 'coco_bad_amount'; end if;
  v_n := case when t.day = d then t.n else 0 end;
  if v_n >= c.daily then raise exception 'coco_limit'; end if;
  select * into s from public.pstate where uid = u for update;
  if s.bananas < p_bet then raise exception 'no_bananas'; end if;

  if p_force is not null and public.is_admin() then
    crash := least(c.cap, greatest(1, floor(p_force * 100) / 100));
  else
    crash := public._coco_draw(c.rtp, c.cap);
  end if;
  update public.pstate set bananas = bananas - p_bet where uid = u;
  update public.mf_coco set day = d, n = v_n + 1, total = total + 1, last = null,
    round = jsonb_build_object('id', total + 1, 'bet', p_bet, 'crash', crash, 'start', public._coco_now() + public._coco_lead())
  where uid = u;
  return public._coco_info(u);
end $$;

-- pendant la grimpe, le téléphone demande toutes les ~0,3 s si le singe est tombé (réponse légère)
create or replace function public.mf_coco_poll()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); t public.mf_coco;
begin
  perform public._coco_settle(u);
  select * into t from public.mf_coco where uid = u;
  if t.round is not null then return jsonb_build_object('run', true, 'id', t.round->'id', 'now', public._coco_now()); end if;
  return jsonb_build_object('run', false, 'last', t.last, 'now', public._coco_now(), 'state', public._state(u));
end $$;

-- encaisser. p_at = multiplicateur affiché au moment du clic.
-- Accepté si le singe n'était pas encore tombé à ce multiplicateur, et si ce multiplicateur était déjà atteint côté serveur
-- (petite marge pour l'écart d'horloge). Le téléphone ne connaît jamais le point de chute à l'avance.
create or replace function public.mf_coco_cash(p_at numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_coco_cfg; t public.mf_coco; crash numeric; el numeric; srv numeric; m numeric;
begin
  select * into c from public.mf_coco_cfg where id = 1;
  select * into t from public.mf_coco where uid = u for update;
  if t.round is null then return public._coco_info(u); end if;   -- déjà finie (tombé entre-temps)
  crash := (t.round->>'crash')::numeric;
  el := public._coco_now() - (t.round->>'start')::bigint;
  srv := public._coco_mult(el, c.speed);
  m := least(c.cap, floor(coalesce(p_at, 0) * 100) / 100);
  if el < 0 or m < 1 then return public._coco_info(u); end if;     -- pas encore parti
  if m > srv * 1.03 + 0.01 then m := srv; end if;                   -- on ne peut pas encaisser plus haut que le singe
  if m < crash and el <= public._coco_at(crash, c.speed) + 2500 then
    perform public._coco_end(u, m);
  else
    perform public._coco_settle(u);
    -- clic arrivé après la chute : partie perdue
    select * into t from public.mf_coco where uid = u;
    if t.round is not null and m >= crash then perform public._coco_end(u, null); end if;
  end if;
  return public._coco_info(u);
end $$;

-- admin : 'reset' (rend les parties du jour), 'open' / 'close' (visible par tous ou non)
create or replace function public.mf_coco_admin(p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_action = 'reset' then
    update public.mf_coco set n = 0 where uid = u;
  elsif p_action = 'open' then
    update public.mf_coco_cfg set open = true where id = 1;
  elsif p_action = 'close' then
    update public.mf_coco_cfg set open = false where id = 1;
  end if;
  return public._coco_info(u);
end $$;

-- les fonctions internes ne s'appellent pas depuis le site
revoke execute on function public._coco_lead(), public._coco_draw(numeric, numeric), public._coco_mult(numeric, numeric),
  public._coco_at(numeric, numeric), public._coco_now(), public._coco_end(uuid, numeric), public._coco_settle(uuid),
  public._coco_info(uuid, boolean) from public, anon, authenticated;

-- durcissement (24/11/2026) : chemin de recherche fixé, fonctions réservées aux joueurs connectés
alter function public._coco_lead() set search_path = public;
alter function public._coco_at(numeric, numeric) set search_path = public;
alter function public._coco_mult(numeric, numeric) set search_path = public;
alter function public._coco_now() set search_path = public;
revoke execute on function public.mf_coco_open(), public.mf_coco_status(), public.mf_coco_start(int, numeric),
  public.mf_coco_poll(), public.mf_coco_cash(numeric), public.mf_coco_admin(text) from public, anon;
grant execute on function public.mf_coco_open(), public.mf_coco_status(), public.mf_coco_start(int, numeric),
  public.mf_coco_poll(), public.mf_coco_cash(numeric), public.mf_coco_admin(text) to authenticated;
