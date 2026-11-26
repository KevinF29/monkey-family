-- Monkey Family — La Tour du Temple (jeu du Casino : on monte un temple étage par étage, 3 portes par étage dont une piégée)
-- À lancer une seule fois dans Supabase. Ne touche à aucune table existante :
-- crée deux tables (mf_tour, mf_tour_cfg) et les fonctions mf_tour_*.
-- Le jeu reste visible par l'admin seulement tant que mf_tour_cfg.open = false
-- (bouton « Ouvrir à tous » dans les réglages admin du jeu).
--
-- Règles (réglables dans mf_tour_cfg) :
--  - 5 montées par jour (heure de Paris), mise de 2 à 10 🍌
--  - à chaque étage, 3 portes dont 1 piégée : le serveur tire la porte piégée AU MOMENT où le joueur choisit
--    (rien à lire à l'avance dans le réseau)
--  - après chaque étage passé, le joueur peut redescendre avec mise × mults[étage] (arrondi au plus proche)
--  - 8 étages : ×1 ×1,3 ×2 ×3 ×4,5 ×6,5 ×10 ×15 ; au sommet, l'idole encaisse toute seule
--  - trappe au 1er étage : la mise est rendue
--  - chances d'arriver à l'étage k : (2/3)^k ; avec le remboursement, le jeu rend 90 à 93 % (100 % en s'arrêtant au 1er étage)

create table if not exists public.mf_tour (
  uid uuid primary key,
  day date,                     -- jour du compteur nb
  nb int not null default 0,    -- montées commencées ce jour-là
  game jsonb,                   -- montée en cours {bet, fl (étages passés), f (forçage admin)}
  hist jsonb not null default '[]'::jsonb,  -- 10 dernières montées (texte)
  total int not null default 0
);
alter table public.mf_tour enable row level security;   -- aucune politique : on passe uniquement par les fonctions

create table if not exists public.mf_tour_cfg (
  id int primary key default 1 check (id = 1),
  open boolean not null default false,
  min_bet int not null default 2,   -- 2 au minimum : avec 1 🍌, le 2e étage (×1,3) ne rapporterait rien
  max_bet int not null default 10,
  games int not null default 5,
  mults jsonb not null default '[1, 1.3, 2, 3, 4.5, 6.5, 10, 15]'::jsonb   -- gain après l'étage 1, 2, … ; la longueur = nombre d'étages
);
alter table public.mf_tour_cfg enable row level security;
insert into public.mf_tour_cfg(id) values (1) on conflict do nothing;

create or replace function public._tour_pay(p_bet int, p_fl int)
returns int language sql stable security definer set search_path = public as $$
  select case when p_fl < 1 then 0 else round(p_bet * coalesce(((select mults from public.mf_tour_cfg where id = 1)->>(p_fl - 1))::numeric, 0))::int end $$;   -- arrondi au plus proche (depuis le 26/11 : avec l'arrondi en dessous, ×1,3 ne rapportait rien aux petites mises)

create or replace function public._tour_info(p_uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.mf_tour_cfg; t public.mf_tour; d date := (now() at time zone 'Europe/Paris')::date;
begin
  select * into c from public.mf_tour_cfg where id = 1;
  select * into t from public.mf_tour where uid = p_uid;
  return jsonb_build_object(
    'open', coalesce(c.open, false), 'min', c.min_bet, 'maxBet', c.max_bet, 'max', c.games, 'mults', c.mults,
    'left', greatest(0, c.games - case when t.day = d then t.nb else 0 end),
    'game', case when t.game is null then null else jsonb_build_object('bet', t.game->'bet', 'fl', t.game->'fl') end,   -- jamais le forçage
    'hist', coalesce(t.hist, '[]'::jsonb),
    'nextDay', (extract(epoch from ((d + 1)::timestamp at time zone 'Europe/Paris')) * 1000)::bigint,
    'now', (extract(epoch from now()) * 1000)::bigint,
    'state', public._state(p_uid));
end $$;

create or replace function public._tour_log(p_uid uuid, txt text)
returns void language sql security definer set search_path = public as $$
  update public.mf_tour set hist = (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select x from jsonb_array_elements(jsonb_build_array(txt) || hist) with ordinality a(x, o) order by o limit 10) z)
  where uid = p_uid $$;

-- le jeu est-il ouvert à tous ? (et dans les jeux de la semaine si on l'ajoute à la rotation du Casino)
create or replace function public.mf_tour_open()
returns boolean language sql security definer set search_path = public as $$
  select coalesce((select open from public.mf_tour_cfg where id = 1), false) and public._casino_on('tour') $$;

create or replace function public.mf_tour_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  if not public.mf_tour_open() and not public.is_admin() then raise exception 'tour_closed'; end if;
  insert into public.mf_tour(uid) values (u) on conflict do nothing;
  return public._tour_info(u);
end $$;

-- nouvelle montée : on paie la mise.
-- Admin seulement : p_force = 'fall' (la prochaine porte choisie est piégée) | 'top' (aucune trappe jusqu'au sommet)
create or replace function public.mf_tour_start(p_bet int, p_force text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_tour_cfg; t public.mf_tour; s public.pstate; d date := (now() at time zone 'Europe/Paris')::date;
  played int; adm boolean := public.is_admin(); f text := case when adm and p_force in ('fall', 'top') then p_force end;
begin
  if not public.mf_tour_open() and not adm then raise exception 'tour_closed'; end if;
  insert into public.mf_tour(uid) values (u) on conflict do nothing;
  select * into t from public.mf_tour where uid = u for update;
  if t.game is not null then raise exception 'tour_in_game'; end if;
  select * into c from public.mf_tour_cfg where id = 1;
  played := case when t.day = d then t.nb else 0 end;
  if played >= c.games then raise exception 'tour_limit'; end if;
  if p_bet is null or p_bet < c.min_bet or p_bet > c.max_bet then raise exception 'tour_bet'; end if;
  select * into s from public.pstate where uid = u for update;
  if s.bananas < p_bet then raise exception 'no_bananas'; end if;
  update public.pstate set bananas = bananas - p_bet where uid = u;
  update public.mf_tour set day = d, nb = played + 1, game = jsonb_build_object('bet', p_bet, 'fl', 0, 'f', f) where uid = u;
  return public._tour_info(u);
end $$;

-- fin de montée (redescente ou sommet) : on paie et on écrit l'historique
create or replace function public._tour_end(p_uid uuid, p_bet int, p_fl int, p_top boolean)
returns int language plpgsql security definer set search_path = public as $$
declare pay int := public._tour_pay(p_bet, p_fl);
begin
  if pay > 0 then update public.pstate set bananas = bananas + pay where uid = p_uid; end if;
  update public.mf_tour set game = null, total = total + 1 where uid = p_uid;
  perform public._tour_log(p_uid, 'Mise ' || p_bet || ' 🍌 · ' || case when p_top then 'SOMMET !' else 'redescendu de l''étage ' || p_fl end
    || ' · ' || case when pay - p_bet >= 0 then '+' else '' end || (pay - p_bet) || ' 🍌');
  if p_top or p_fl >= 6 then
    perform public._feed(jsonb_build_object('kind', 'tour', 'uid', p_uid, 'v', pay - p_bet, 'fl', p_fl, 'top', p_top));
  end if;
  return pay;
end $$;

-- le joueur ouvre une porte (0 gauche, 1 milieu, 2 droite) de l'étage suivant
create or replace function public.mf_tour_pick(p_door int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_tour_cfg; t public.mf_tour; g jsonb; bet int; fl int; f text; trap int; n int; pay int := 0; lost int;
begin
  if p_door is null or p_door not between 0 and 2 then raise exception 'tour_door'; end if;
  select * into t from public.mf_tour where uid = u for update;
  if t.game is null then raise exception 'tour_no_game'; end if;
  select * into c from public.mf_tour_cfg where id = 1;
  g := t.game; bet := (g->>'bet')::int; fl := (g->>'fl')::int; f := g->>'f'; n := jsonb_array_length(c.mults);
  if fl >= n then raise exception 'tour_no_game'; end if;

  -- la porte piégée est tirée maintenant
  if f = 'fall' then trap := p_door;
  elsif f = 'top' then trap := (p_door + 1 + floor(random() * 2)::int) % 3;
  else trap := floor(random() * 3)::int;
  end if;

  if trap = p_door then
    lost := public._tour_pay(bet, fl);   -- ce qu'il avait « en poche »
    update public.mf_tour set game = null, total = total + 1 where uid = u;
    if fl = 0 then   -- trappe au 1er étage : la mise est rendue (choix de Kévin, 26/11)
      update public.pstate set bananas = bananas + bet where uid = u;
      perform public._tour_log(u, 'Mise ' || bet || ' 🍌 · trappe au 1er étage · mise rendue');
    else
      perform public._tour_log(u, 'Mise ' || bet || ' 🍌 · trappe à l''étage ' || (fl + 1) || ' · −' || bet || ' 🍌');
    end if;
    if fl >= 5 then perform public._feed(jsonb_build_object('kind', 'tour_fall', 'uid', u, 'fl', fl + 1, 'v', lost)); end if;
    return jsonb_build_object('door', p_door, 'trap', trap, 'out', 'fall', 'fl', fl, 'bet', bet, 'pay', case when fl = 0 then bet else 0 end,
      'refund', fl = 0, 'lost', lost, 'info', public._tour_info(u));
  end if;

  fl := fl + 1;
  if fl >= n then   -- sommet : l'idole encaisse toute seule
    pay := public._tour_end(u, bet, fl, true);
    return jsonb_build_object('door', p_door, 'trap', trap, 'out', 'top', 'fl', fl, 'bet', bet, 'pay', pay, 'net', pay - bet, 'info', public._tour_info(u));
  end if;
  update public.mf_tour set game = jsonb_set(g, '{fl}', to_jsonb(fl)) where uid = u;
  return jsonb_build_object('door', p_door, 'trap', trap, 'out', 'up', 'fl', fl, 'bet', bet, 'pay', public._tour_pay(bet, fl), 'info', public._tour_info(u));
end $$;

-- le joueur redescend avec son butin (au moins un étage passé)
create or replace function public.mf_tour_cash()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); t public.mf_tour; bet int; fl int; pay int;
begin
  select * into t from public.mf_tour where uid = u for update;
  if t.game is null then raise exception 'tour_no_game'; end if;
  bet := (t.game->>'bet')::int; fl := (t.game->>'fl')::int;
  if fl < 1 then raise exception 'tour_ground'; end if;
  pay := public._tour_end(u, bet, fl, false);
  return jsonb_build_object('out', 'cash', 'fl', fl, 'bet', bet, 'pay', pay, 'net', pay - bet, 'info', public._tour_info(u));
end $$;

-- admin : 'reset' (rend les montées du jour et annule la montée en cours), 'bananas' (+50 🍌 pour soi), 'open' / 'close'
create or replace function public.mf_tour_admin(p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  insert into public.mf_tour(uid) values (u) on conflict do nothing;
  if p_action = 'reset' then
    update public.mf_tour set nb = 0, game = null where uid = u;
  elsif p_action = 'bananas' then
    update public.pstate set bananas = bananas + 50 where uid = u;
  elsif p_action = 'open' then
    update public.mf_tour_cfg set open = true where id = 1;
  elsif p_action = 'close' then
    update public.mf_tour_cfg set open = false where id = 1;
  end if;
  return public._tour_info(u);
end $$;

-- les fonctions internes ne s'appellent pas depuis le site
revoke execute on function public._tour_info(uuid), public._tour_log(uuid, text), public._tour_end(uuid, int, int, boolean), public._tour_pay(int, int) from public, anon, authenticated;
revoke execute on function public.mf_tour_status(), public.mf_tour_start(int, text), public.mf_tour_pick(int), public.mf_tour_cash(), public.mf_tour_admin(text) from public, anon;
grant execute on function public.mf_tour_open(), public.mf_tour_status(), public.mf_tour_start(int, text),
  public.mf_tour_pick(int), public.mf_tour_cash(), public.mf_tour_admin(text) to authenticated;
