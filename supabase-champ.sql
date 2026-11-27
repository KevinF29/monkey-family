-- Monkey Family — Le Champ de Cocos (jeu du Casino façon « Mines » : 25 noix de coco, des serpents cachés dessous)
-- À lancer une seule fois dans Supabase. Ne touche à aucune table existante :
-- crée deux tables (mf_mine, mf_mine_cfg) et les fonctions mf_mine_* / _mine_*.
-- Le jeu reste visible par l'admin seulement tant que mf_mine_cfg.open = false
-- (bouton « Ouvrir à tous » dans les réglages admin du jeu).
--
-- Règles (toutes réglables dans mf_mine_cfg) :
--  - grille de 5 × 5 noix de coco ; le joueur choisit 3, 4 ou 5 serpents avant de jouer
--  - mise de 1 à 10 🍌, 10 parties par jour (heure de Paris)
--  - les serpents sont placés par le serveur au départ et ne sont jamais envoyés à la page avant la fin
--  - chaque coco ouverte sans serpent fait monter le multiplicateur :
--      m(k) = rtp × C(25, k) / C(25 − serpents, k)   (rtp = 0,95 : le jeu rend 95 % des mises quelle que soit la stratégie)
--  - on encaisse quand on veut (au moins une coco ouverte) : mise × m, arrondi en dessous
--  - plafond ×25 (gain max 250 🍌) : la partie s'encaisse toute seule quand il est atteint, ou quand toutes les cocos sûres sont ouvertes
--  - serpent = mise perdue, toute la grille est dévoilée
--  - tour par tour : pas de chrono, une partie commencée attend le joueur (même appli fermée, même le lendemain)

create table if not exists public.mf_mine (
  uid uuid primary key,
  day date,                     -- jour du compteur nb
  nb int not null default 0,    -- parties commencées ce jour-là
  game jsonb,                   -- partie en cours {bet, n, snakes:[cases], open:[cases], f}
  hist jsonb not null default '[]'::jsonb,  -- 10 dernières parties (texte)
  total int not null default 0
);
alter table public.mf_mine enable row level security;   -- aucune politique : on passe uniquement par les fonctions

create table if not exists public.mf_mine_cfg (
  id int primary key default 1 check (id = 1),
  open boolean not null default false,
  min_bet int not null default 1,
  max_bet int not null default 10,
  games int not null default 10,
  snakes int[] not null default '{3,4,5}',
  rtp numeric not null default 0.95,
  cap numeric not null default 25
);
alter table public.mf_mine_cfg enable row level security;
insert into public.mf_mine_cfg(id) values (1) on conflict do nothing;

-- multiplicateur après k cocos sûres avec n serpents (2 décimales, arrondi en dessous, plafonné)
create or replace function public._mine_mult(n int, k int)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare c public.mf_mine_cfg; m numeric := 1; i int;
begin
  select * into c from public.mf_mine_cfg where id = 1;
  if k <= 0 then return 1; end if;
  for i in 0..k - 1 loop m := m * (25 - i)::numeric / (25 - n - i); end loop;
  return round(least(c.cap, floor(c.rtp * m * 100) / 100), 2);
end $$;

create or replace function public._mine_info(p_uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.mf_mine_cfg; t public.mf_mine; d date := (now() at time zone 'Europe/Paris')::date; g jsonb; k int; n int;
begin
  select * into c from public.mf_mine_cfg where id = 1;
  select * into t from public.mf_mine where uid = p_uid;
  g := t.game;
  if g is not null then
    n := (g->>'n')::int; k := jsonb_array_length(g->'open');
    g := jsonb_build_object('bet', g->'bet', 'n', n, 'open', g->'open',          -- jamais la place des serpents
      'mult', public._mine_mult(n, k), 'next', public._mine_mult(n, k + 1),
      'pay', floor((g->>'bet')::int * public._mine_mult(n, k))::int);
  end if;
  return jsonb_build_object(
    'open', coalesce(c.open, false), 'min', c.min_bet, 'maxBet', c.max_bet, 'max', c.games,
    'snakes', to_jsonb(c.snakes), 'cap', c.cap, 'rtp', c.rtp,
    'left', greatest(0, c.games - case when t.day = d then t.nb else 0 end),
    'game', g,
    'hist', coalesce(t.hist, '[]'::jsonb),
    'nextDay', (extract(epoch from ((d + 1)::timestamp at time zone 'Europe/Paris')) * 1000)::bigint,
    'now', (extract(epoch from now()) * 1000)::bigint,
    'state', public._state(p_uid));
end $$;

create or replace function public._mine_log(p_uid uuid, txt text)
returns void language sql security definer set search_path = public as $$
  update public.mf_mine set hist = (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select x from jsonb_array_elements(jsonb_build_array(txt) || hist) with ordinality a(x, o) order by o limit 10) z)
  where uid = p_uid $$;

-- fin de partie (encaissement ou serpent) : paie, vide la partie, historique, fil d'actu
create or replace function public._mine_end(p_uid uuid, p_boom int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.mf_mine; g jsonb; bet int; n int; k int; m numeric; pay int := 0; txt text; fm text;
begin
  select * into t from public.mf_mine where uid = p_uid for update;
  g := t.game; bet := (g->>'bet')::int; n := (g->>'n')::int; k := jsonb_array_length(g->'open');
  if p_boom is null then m := public._mine_mult(n, k); pay := floor(bet * m)::int;
  else m := public._mine_mult(n, k + 1); end if;   -- multiplicateur qu'aurait donné la coco du serpent
  if pay > 0 then update public.pstate set bananas = bananas + pay where uid = p_uid; end if;
  update public.mf_mine set game = null, total = total + 1 where uid = p_uid;
  fm := '×' || replace(regexp_replace(round(m, 2)::text, '\.00$|(\.\d)0$', '\1'), '.', ',');
  txt := 'Mise ' || bet || ' 🍌 · ' || n || ' serpents · ' || case when p_boom is null
    then k || ' coco' || case when k > 1 then 's' else '' end || ', encaissé à ' || fm || ' : ' || case when pay - bet >= 0 then '+' else '' end || (pay - bet) || ' 🍌'
    else 'serpent à la ' || (k + 1) || case when k = 0 then 're' else 'e' end || ' coco 🐍' end;
  perform public._mine_log(p_uid, txt);
  if not public.is_admin() then
    if p_boom is null and pay - bet >= 25 then
      perform public._feed(jsonb_build_object('kind', 'mine', 'uid', p_uid, 'v', pay - bet, 'm', m, 'k', k, 'n', n));
    elsif p_boom is not null and k >= 8 then
      perform public._feed(jsonb_build_object('kind', 'mine_bite', 'uid', p_uid, 'k', k, 'n', n, 'v', bet));
    end if;
  end if;
  return jsonb_build_object('out', case when p_boom is null then 'cash' else 'boom' end, 'boom', p_boom,
    'snakes', g->'snakes', 'open', g->'open', 'bet', bet, 'n', n, 'k', k, 'mult', m, 'pay', pay, 'net', pay - bet,
    'info', public._mine_info(p_uid));
end $$;

-- le jeu est-il ouvert à tous ? (et dans les jeux de la semaine si on l'ajoute un jour à la rotation du Casino)
create or replace function public.mf_mine_open()
returns boolean language sql security definer set search_path = public as $$
  select coalesce((select open from public.mf_mine_cfg where id = 1), false) and public._casino_on('mine') $$;

create or replace function public.mf_mine_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  if not public.mf_mine_open() and not public.is_admin() then raise exception 'mine_closed'; end if;
  insert into public.mf_mine(uid) values (u) on conflict do nothing;
  return public._mine_info(u);
end $$;

-- nouvelle partie : on paie la mise, le serveur place les serpents.
-- Admin seulement : p_force = 'boom' (la prochaine coco ouverte cache un serpent) | 'lucky' (aucun serpent tant qu'il reste des cocos sûres ailleurs)
create or replace function public.mf_mine_start(p_bet int, p_snakes int, p_force text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_mine_cfg; t public.mf_mine; s public.pstate; d date := (now() at time zone 'Europe/Paris')::date;
  played int; adm boolean := public.is_admin(); f text := case when adm and p_force in ('boom', 'lucky') then p_force end; sn jsonb;
begin
  if not public.mf_mine_open() and not adm then raise exception 'mine_closed'; end if;
  insert into public.mf_mine(uid) values (u) on conflict do nothing;
  select * into t from public.mf_mine where uid = u for update;
  if t.game is not null then raise exception 'mine_in_game'; end if;
  select * into c from public.mf_mine_cfg where id = 1;
  played := case when t.day = d then t.nb else 0 end;
  if played >= c.games then raise exception 'mine_limit'; end if;
  if p_bet is null or p_bet < c.min_bet or p_bet > c.max_bet then raise exception 'mine_bet'; end if;
  if p_snakes is null or not (p_snakes = any(c.snakes)) then raise exception 'mine_snakes'; end if;
  select * into s from public.pstate where uid = u for update;
  if s.bananas < p_bet then raise exception 'no_bananas'; end if;
  update public.pstate set bananas = bananas - p_bet where uid = u;
  select jsonb_agg(x order by x) into sn from (select x from generate_series(0, 24) x order by random() limit p_snakes) z;
  update public.mf_mine set day = d, nb = played + 1,
    game = jsonb_build_object('bet', p_bet, 'n', p_snakes, 'snakes', sn, 'open', '[]'::jsonb, 'f', f) where uid = u;
  return public._mine_info(u);
end $$;

-- le joueur ouvre une coco (case 0 à 24, de gauche à droite puis de haut en bas)
create or replace function public.mf_mine_pick(p_cell int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); t public.mf_mine; g jsonb; sn int[]; op int[]; f text; n int; k int; alt int; boom boolean;
begin
  if p_cell is null or p_cell not between 0 and 24 then raise exception 'mine_cell'; end if;
  select * into t from public.mf_mine where uid = u for update;
  if t.game is null then raise exception 'mine_no_game'; end if;
  g := t.game; f := g->>'f'; n := (g->>'n')::int;
  select coalesce(array_agg(x::int), '{}') into sn from jsonb_array_elements_text(g->'snakes') x;
  select coalesce(array_agg(x::int), '{}') into op from jsonb_array_elements_text(g->'open') x;
  if p_cell = any(op) then raise exception 'mine_opened'; end if;
  -- forçages admin : on déplace un serpent (la grille reste cohérente, elle est dévoilée à la fin)
  if f = 'lucky' and p_cell = any(sn) then
    select x into alt from generate_series(0, 24) x where x <> p_cell and not (x = any(sn)) and not (x = any(op)) order by random() limit 1;
    if alt is not null then sn := array_replace(sn, p_cell, alt); end if;
  elsif f = 'boom' and not (p_cell = any(sn)) then
    sn[1 + floor(random() * n)::int] := p_cell;
  end if;
  if f is not null then
    g := jsonb_set(g, '{snakes}', (select jsonb_agg(x order by x) from unnest(sn) x));
    if f = 'boom' then g := g - 'f'; end if;   -- « boom » ne vaut que pour une coco
    update public.mf_mine set game = g where uid = u;
  end if;
  boom := p_cell = any(sn);
  if boom then return public._mine_end(u, p_cell) || jsonb_build_object('cell', p_cell, 'safe', false); end if;

  g := jsonb_set(g, '{open}', (g->'open') || to_jsonb(p_cell));
  update public.mf_mine set game = g where uid = u;
  k := jsonb_array_length(g->'open');
  -- toutes les cocos sûres ouvertes, ou plafond atteint : encaissement automatique
  if k >= 25 - n or public._mine_mult(n, k) >= (select cap from public.mf_mine_cfg where id = 1) then
    return public._mine_end(u, null) || jsonb_build_object('cell', p_cell, 'safe', true, 'auto', true);
  end if;
  return jsonb_build_object('cell', p_cell, 'safe', true, 'out', null, 'info', public._mine_info(u));
end $$;

-- encaisser (au moins une coco ouverte)
create or replace function public.mf_mine_cash()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); t public.mf_mine;
begin
  select * into t from public.mf_mine where uid = u for update;
  if t.game is null then raise exception 'mine_no_game'; end if;
  if jsonb_array_length(t.game->'open') < 1 then raise exception 'mine_none'; end if;
  return public._mine_end(u, null);
end $$;

-- admin : 'reset' (rend les parties du jour et annule la partie en cours), 'bananas' (+50 🍌 pour soi), 'open' / 'close'
create or replace function public.mf_mine_admin(p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  insert into public.mf_mine(uid) values (u) on conflict do nothing;
  if p_action = 'reset' then
    update public.mf_mine set nb = 0, game = null where uid = u;
  elsif p_action = 'bananas' then
    update public.pstate set bananas = bananas + 50 where uid = u;
  elsif p_action = 'open' then
    update public.mf_mine_cfg set open = true where id = 1;
  elsif p_action = 'close' then
    update public.mf_mine_cfg set open = false where id = 1;
  end if;
  return public._mine_info(u);
end $$;

-- les fonctions internes ne s'appellent pas depuis le site
revoke execute on function public._mine_mult(int, int), public._mine_info(uuid), public._mine_log(uuid, text), public._mine_end(uuid, int)
  from public, anon, authenticated;
revoke execute on function public.mf_mine_open(), public.mf_mine_status(), public.mf_mine_start(int, int, text),
  public.mf_mine_pick(int), public.mf_mine_cash(), public.mf_mine_admin(text) from public, anon;
grant execute on function public.mf_mine_open(), public.mf_mine_status(), public.mf_mine_start(int, int, text),
  public.mf_mine_pick(int), public.mf_mine_cash(), public.mf_mine_admin(text) to authenticated;
