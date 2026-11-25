-- Monkey Family — Monkey Bonneteau (jeu du Casino : 3 noix de coco, une banane cachée dessous)
-- À lancer une seule fois dans Supabase. Ne touche à aucune table existante :
-- crée deux tables (mf_bon, mf_bon_cfg) et les fonctions mf_bon_*.
-- Le jeu reste visible par l'admin seulement tant que mf_bon_cfg.open = false
-- (bouton « Ouvrir à tous » dans les réglages admin du jeu).
--
-- Règles :
--  - 10 parties par jour (heure de Paris), mise de 1 à 20 🍌 (réglables dans mf_bon_cfg)
--  - au départ, le serveur cache la banane sous une des 3 noix (0, 1 ou 2) ; le mélange affiché ne compte pas :
--    c'est du pur hasard, 1 chance sur 3
--  - bonne noix : la mise × mult (3) revient au joueur
--  - singe tricheur : quand le joueur a trouvé, mf_bon_cfg.cheat (8 %) de chances que le singe ait escamoté
--    la banane (toutes les noix sont vides) ; c'est annoncé dans le fil d'actu
--  - le jeu rend 3 × 1/3 × 0,92 = 92 % des mises
--  - la place de la banane n'est jamais envoyée à la page avant le choix

create table if not exists public.mf_bon (
  uid uuid primary key,
  day date,                     -- jour du compteur nb
  nb int not null default 0,    -- parties jouées ce jour-là
  game jsonb,                   -- partie en cours {bet, pos, f}
  hist jsonb not null default '[]'::jsonb,  -- 10 dernières parties (texte)
  total int not null default 0
);
alter table public.mf_bon enable row level security;   -- aucune politique : on passe uniquement par les fonctions

create table if not exists public.mf_bon_cfg (
  id int primary key default 1 check (id = 1),
  open boolean not null default false,
  min_bet int not null default 1,
  max_bet int not null default 20,
  games int not null default 10,
  mult int not null default 3,            -- bonne noix : la mise × mult revient au joueur
  cheat numeric not null default 0.08     -- chance que le singe escamote la banane quand le joueur a trouvé
);
alter table public.mf_bon_cfg enable row level security;
insert into public.mf_bon_cfg(id) values (1) on conflict do nothing;

create or replace function public._bon_info(p_uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.mf_bon_cfg; t public.mf_bon; d date := (now() at time zone 'Europe/Paris')::date;
begin
  select * into c from public.mf_bon_cfg where id = 1;
  select * into t from public.mf_bon where uid = p_uid;
  return jsonb_build_object(
    'open', coalesce(c.open, false), 'min', c.min_bet, 'maxBet', c.max_bet, 'max', c.games, 'mult', c.mult,
    'left', greatest(0, c.games - case when t.day = d then t.nb else 0 end),
    'game', case when t.game is null then null else jsonb_build_object('bet', t.game->'bet') end,   -- jamais la place de la banane
    'hist', coalesce(t.hist, '[]'::jsonb),
    'nextDay', (extract(epoch from ((d + 1)::timestamp at time zone 'Europe/Paris')) * 1000)::bigint,
    'now', (extract(epoch from now()) * 1000)::bigint,
    'state', public._state(p_uid));
end $$;

create or replace function public._bon_log(p_uid uuid, txt text)
returns void language sql security definer set search_path = public as $$
  update public.mf_bon set hist = (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select x from jsonb_array_elements(jsonb_build_array(txt) || hist) with ordinality a(x, o) order by o limit 10) z)
  where uid = p_uid $$;

-- le jeu est-il ouvert à tous ? (et dans les jeux de la semaine si on l'ajoute un jour à la rotation du Casino)
create or replace function public.mf_bon_open()
returns boolean language sql security definer set search_path = public as $$
  select coalesce((select open from public.mf_bon_cfg where id = 1), false) and public._casino_on('bon') $$;

create or replace function public.mf_bon_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  if not public.mf_bon_open() and not public.is_admin() then raise exception 'bon_closed'; end if;
  insert into public.mf_bon(uid) values (u) on conflict do nothing;
  return public._bon_info(u);
end $$;

-- nouvelle partie : on paie la mise, le serveur cache la banane.
-- Admin seulement : p_force = 'win' (la banane sera sous la noix choisie) | 'lose' | 'cheat' (trouvée mais escamotée)
create or replace function public.mf_bon_start(p_bet int, p_force text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_bon_cfg; t public.mf_bon; s public.pstate; d date := (now() at time zone 'Europe/Paris')::date;
  played int; adm boolean := public.is_admin(); f text := case when adm then nullif(p_force, '') end;
begin
  if not public.mf_bon_open() and not adm then raise exception 'bon_closed'; end if;
  insert into public.mf_bon(uid) values (u) on conflict do nothing;
  select * into t from public.mf_bon where uid = u for update;
  if t.game is not null then raise exception 'bon_in_game'; end if;
  select * into c from public.mf_bon_cfg where id = 1;
  played := case when t.day = d then t.nb else 0 end;
  if played >= c.games then raise exception 'bon_limit'; end if;
  if p_bet is null or p_bet < c.min_bet or p_bet > c.max_bet then raise exception 'bon_bet'; end if;
  select * into s from public.pstate where uid = u for update;
  if s.bananas < p_bet then raise exception 'no_bananas'; end if;
  update public.pstate set bananas = bananas - p_bet where uid = u;
  update public.mf_bon set day = d, nb = played + 1,
    game = jsonb_build_object('bet', p_bet, 'pos', floor(random() * 3)::int, 'f', f) where uid = u;
  return jsonb_build_object('info', public._bon_info(u));
end $$;

-- le joueur soulève une noix (0, 1 ou 2)
create or replace function public.mf_bon_pick(p_cup int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_bon_cfg; t public.mf_bon; g jsonb; bet int; pos int; f text;
  res text; cheat boolean := false; pay int := 0; txt text;
begin
  if p_cup is null or p_cup not between 0 and 2 then raise exception 'bon_cup'; end if;
  select * into t from public.mf_bon where uid = u for update;
  if t.game is null then raise exception 'bon_no_game'; end if;
  select * into c from public.mf_bon_cfg where id = 1;
  g := t.game; bet := (g->>'bet')::int; pos := (g->>'pos')::int; f := g->>'f';
  if f in ('win', 'cheat') then pos := p_cup;
  elsif f = 'lose' and pos = p_cup then pos := (p_cup + 1 + floor(random() * 2)::int) % 3;
  end if;

  if pos = p_cup then
    if f = 'cheat' or (f is null and random() < c.cheat) then res := 'cheat'; cheat := true;
    else res := 'win'; pay := c.mult * bet; end if;
  else
    res := 'lose';
  end if;

  if pay > 0 then update public.pstate set bananas = bananas + pay where uid = u; end if;
  update public.mf_bon set game = null, total = total + 1 where uid = u;

  txt := 'Mise ' || bet || ' 🍌 · ' || case res when 'win' then 'trouvée ! +' || (pay - bet) || ' 🍌'
    when 'cheat' then 'trouvée… mais le singe avait escamoté la banane 🙈' else 'perdu' end;
  perform public._bon_log(u, txt);

  if res = 'win' and pay - bet >= 30 then
    perform public._feed(jsonb_build_object('kind', 'bon', 'uid', u, 'v', pay - bet));
  end if;
  if cheat then perform public._feed(jsonb_build_object('kind', 'bon_cheat', 'uid', u, 'v', bet)); end if;

  return jsonb_build_object('pick', p_cup, 'pos', case when cheat then null else pos end, 'out', res, 'bet', bet,
    'pay', pay, 'net', pay - bet, 'cheat', cheat, 'info', public._bon_info(u));
end $$;

-- admin : 'reset' (rend les parties du jour et annule la partie en cours), 'bananas' (+50 🍌 pour soi), 'open' / 'close'
create or replace function public.mf_bon_admin(p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  insert into public.mf_bon(uid) values (u) on conflict do nothing;
  if p_action = 'reset' then
    update public.mf_bon set nb = 0, game = null where uid = u;
  elsif p_action = 'bananas' then
    update public.pstate set bananas = bananas + 50 where uid = u;
  elsif p_action = 'open' then
    update public.mf_bon_cfg set open = true where id = 1;
  elsif p_action = 'close' then
    update public.mf_bon_cfg set open = false where id = 1;
  end if;
  return public._bon_info(u);
end $$;

-- les fonctions internes ne s'appellent pas depuis le site
revoke execute on function public._bon_info(uuid), public._bon_log(uuid, text) from public, anon, authenticated;
revoke execute on function public.mf_bon_status(), public.mf_bon_start(int, text), public.mf_bon_pick(int), public.mf_bon_admin(text) from public, anon;
grant execute on function public.mf_bon_open(), public.mf_bon_status(), public.mf_bon_start(int, text),
  public.mf_bon_pick(int), public.mf_bon_admin(text) to authenticated;
