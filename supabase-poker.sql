-- Monkey Family — Poker Monkey (vidéo poker 5 cartes du Casino, avec le Joker singe)
-- À lancer une seule fois dans Supabase. Ne touche à aucune table existante :
-- crée deux tables (mf_vp, mf_vp_cfg) et les fonctions mf_vp_*.
-- Le jeu reste visible par l'admin seulement tant que mf_vp_cfg.open = false.
--
-- Règles :
--  - 10 mains par jour (heure de Paris), mise de 1 à 20 🍌 (réglables dans mf_vp_cfg)
--  - paquet de 53 cartes : 0..51 (rang = c % 13 : 0 = As, 1..8 = 2..9, 9 = 10, 10 V, 11 D, 12 R ; couleur = c / 13 : ♠ ♥ ♦ ♣)
--    + 52 = le Joker singe, qui remplace n'importe quelle carte
--  - 5 cartes, le joueur garde celles qu'il veut, les autres sont remplacées une seule fois par les suivantes du paquet
--  - gain = mise × multiplicateur de la main finale (mf_vp_cfg.pays, dans l'ordre des codes ci-dessous ; ce qui revient au joueur) :
--    0 rien ×0 · 1 paire de Valets ou mieux ×1 (Rois ou mieux avant le 27/11) · 2 double paire ×1 · 3 brelan ×2 · 4 quinte ×3 · 5 couleur ×5 · 6 full ×7
--    7 carré ×20 · 8 quinte flush ×50 · 9 quinte flush royale avec le Joker ×100 · 10 cinq identiques (avec le Joker) ×200
--    11 quinte flush royale sans Joker ×250
--  - le paquet mélangé reste sur le serveur : la page ne voit que ses 5 cartes

create table if not exists public.mf_vp (
  uid uuid primary key,
  day date,                     -- jour du compteur nb
  nb int not null default 0,    -- mains jouées ce jour-là
  hand jsonb,                   -- main en cours {bet, c: 5 cartes, deck: le reste du paquet}
  hist jsonb not null default '[]'::jsonb,  -- 10 dernières mains (texte)
  total int not null default 0
);
alter table public.mf_vp enable row level security;   -- aucune politique : on passe uniquement par les fonctions

create table if not exists public.mf_vp_cfg (
  id int primary key default 1 check (id = 1),
  open boolean not null default false,
  min_bet int not null default 1,
  max_bet int not null default 20,
  hands int not null default 10,
  pays jsonb not null default '[0,1,1,2,3,5,7,20,50,100,200,250]'::jsonb
);
alter table public.mf_vp_cfg enable row level security;
insert into public.mf_vp_cfg(id) values (1) on conflict do nothing;

-- catégorie d'une main de 5 cartes sans Joker (les cartes en double sont permises : utile pour essayer le Joker)
create or replace function public._vp_cat5(p int[])
returns int language plpgsql immutable set search_path = public as $$
declare cnt int[] := array_fill(0, array[13]); r int; i int; s0 int := p[1] / 13; fl boolean := true;
  mx int := 0; pairs int := 0; trips boolean := false; dist int := 0; hp boolean := false; st boolean := false; lo int := 99; hi int := 0; v int;
begin
  for i in 1..5 loop
    r := p[i] % 13; cnt[r + 1] := cnt[r + 1] + 1;
    if p[i] / 13 <> s0 then fl := false; end if;
  end loop;
  for r in 0..12 loop
    if cnt[r + 1] > 0 then dist := dist + 1; end if;
    if cnt[r + 1] > mx then mx := cnt[r + 1]; end if;
    if cnt[r + 1] = 2 then pairs := pairs + 1; if r in (0, 10, 11, 12) then hp := true; end if; end if;
    if cnt[r + 1] = 3 then trips := true; end if;
  end loop;
  if mx = 5 then return 10; end if;
  if dist = 5 then
    for i in 1..5 loop v := case when p[i] % 13 = 0 then 14 else p[i] % 13 + 1 end; lo := least(lo, v); hi := greatest(hi, v); end loop;
    st := hi - lo = 4 or (cnt[1] > 0 and cnt[2] > 0 and cnt[3] > 0 and cnt[4] > 0 and cnt[5] > 0);   -- As-2-3-4-5
  end if;
  if st and fl then return case when lo = 10 then 11 else 8 end; end if;
  if mx = 4 then return 7; end if;
  if trips and pairs > 0 then return 6; end if;
  if fl then return 5; end if;
  if st then return 4; end if;
  if trips then return 3; end if;
  if pairs = 2 then return 2; end if;
  if hp then return 1; end if;
  return 0;
end $$;

-- catégorie d'une main (avec le Joker : on essaie les 52 cartes et on garde la meilleure ; royale avec Joker = 9)
create or replace function public._vp_cat(h jsonb)
returns int language plpgsql immutable set search_path = public as $$
declare p int[]; j int; x int; k int; best int := 0;
begin
  select array_agg(e::int order by o) into p from jsonb_array_elements_text(h) with ordinality a(e, o);
  j := array_position(p, 52);
  if j is null then return public._vp_cat5(p); end if;
  for x in 0..51 loop
    p[j] := x; k := public._vp_cat5(p);
    if k = 11 then k := 9; end if;
    if k > best then best := k; end if;
  end loop;
  return best;
end $$;

create or replace function public._vp_name(k int) returns text language sql immutable as $$
  select (array['Rien','Paire de Valets ou mieux','Double paire','Brelan','Quinte','Couleur','Full','Carré','Quinte flush',
    'Quinte flush royale (Joker)','Cinq identiques','Quinte flush royale'])[k + 1] $$;

create or replace function public._vp_info(p_uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.mf_vp_cfg; t public.mf_vp; d date := (now() at time zone 'Europe/Paris')::date; h jsonb;
begin
  select * into c from public.mf_vp_cfg where id = 1;
  select * into t from public.mf_vp where uid = p_uid;
  if t.hand is not null then   -- jamais le reste du paquet
    h := jsonb_build_object('bet', t.hand->'bet', 'c', t.hand->'c', 'cat', public._vp_cat(t.hand->'c'));
  end if;
  return jsonb_build_object(
    'open', coalesce(c.open, false), 'min', c.min_bet, 'maxBet', c.max_bet, 'max', c.hands, 'pays', c.pays,
    'left', greatest(0, c.hands - case when t.day = d then t.nb else 0 end),
    'hand', h,
    'hist', coalesce(t.hist, '[]'::jsonb),
    'nextDay', (extract(epoch from ((d + 1)::timestamp at time zone 'Europe/Paris')) * 1000)::bigint,
    'now', (extract(epoch from now()) * 1000)::bigint,
    'state', public._state(p_uid));
end $$;

create or replace function public._vp_log(p_uid uuid, txt text)
returns void language sql security definer set search_path = public as $$
  update public.mf_vp set hist = (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select x from jsonb_array_elements(jsonb_build_array(txt) || hist) with ordinality a(x, o) order by o limit 10) z)
  where uid = p_uid $$;

-- ouvert à tous ? (et dans les jeux de la semaine, si on l'ajoute un jour à la rotation du Casino avec l'id 'vp')
create or replace function public.mf_vp_open()
returns boolean language sql security definer set search_path = public as $$
  select coalesce((select open from public.mf_vp_cfg where id = 1), false) and public._casino_on('vp') $$;

create or replace function public.mf_vp_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  if not public.mf_vp_open() and not public.is_admin() then raise exception 'vp_closed'; end if;
  insert into public.mf_vp(uid) values (u) on conflict do nothing;
  return public._vp_info(u);
end $$;

-- nouvelle main. Admin seulement : p_force = 'royal' | 'five' | 'quads' | 'joker' | 'sf'
create or replace function public.mf_vp_deal(p_bet int, p_force text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_vp_cfg; t public.mf_vp; s public.pstate; d date := (now() at time zone 'Europe/Paris')::date;
  played int; adm boolean := public.is_admin(); f text := case when adm then nullif(p_force, '') end;
  v_deck int[]; v_first int[]; v_suit int := floor(random() * 4)::int;
begin
  if not public.mf_vp_open() and not adm then raise exception 'vp_closed'; end if;
  insert into public.mf_vp(uid) values (u) on conflict do nothing;
  select * into t from public.mf_vp where uid = u for update;
  if t.hand is not null then raise exception 'vp_in_hand'; end if;
  select * into c from public.mf_vp_cfg where id = 1;
  played := case when t.day = d then t.nb else 0 end;
  if played >= c.hands then raise exception 'vp_limit'; end if;
  if p_bet is null or p_bet < c.min_bet or p_bet > c.max_bet then raise exception 'vp_bet'; end if;
  select * into s from public.pstate where uid = u for update;
  if s.bananas < p_bet then raise exception 'no_bananas'; end if;
  update public.pstate set bananas = bananas - p_bet where uid = u;
  update public.mf_vp set day = d, nb = played + 1 where uid = u;

  v_first := case f
    when 'royal' then array[v_suit * 13, v_suit * 13 + 12, v_suit * 13 + 11, v_suit * 13 + 10, v_suit * 13 + 9]   -- As, R, D, V, 10 de la même couleur
    when 'sf' then array[v_suit * 13 + 4, v_suit * 13 + 5, v_suit * 13 + 6, v_suit * 13 + 7, v_suit * 13 + 8]       -- 5 à 9 de la même couleur
    when 'five' then array[6, 19, 32, 45, 52]                     -- quatre 7 + le Joker
    when 'quads' then array[12, 25, 38, 51, 3]                    -- quatre Rois + un 4
    when 'joker' then array[52]
    else array[]::int[] end;
  select v_first || coalesce(array_agg(x order by random()), array[]::int[]) into v_deck
    from generate_series(0, 52) x where not (x = any(v_first));
  update public.mf_vp set hand = jsonb_build_object('bet', p_bet, 'c', to_jsonb(v_deck[1:5]), 'deck', to_jsonb(v_deck[6:53]))
    where uid = u;
  return jsonb_build_object('info', public._vp_info(u));
end $$;

-- échange : p_hold = positions gardées (0 à 4). La main se termine et se paie.
create or replace function public.mf_vp_draw(p_hold int[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_vp_cfg; t public.mf_vp; h jsonb; v_cards jsonb := '[]'::jsonb; v_deck jsonb;
  i int; q int := 0; bet int; k int; mult int; pay int; changed int := 0; joker boolean;
begin
  select * into t from public.mf_vp where uid = u for update;
  if t.hand is null then raise exception 'vp_no_hand'; end if;
  select * into c from public.mf_vp_cfg where id = 1;
  h := t.hand; bet := (h->>'bet')::int; v_deck := h->'deck';
  for i in 0..4 loop
    if i = any(coalesce(p_hold, array[]::int[])) then
      v_cards := v_cards || (h->'c'->i);
    else
      v_cards := v_cards || (v_deck->q); q := q + 1; changed := changed + 1;
    end if;
  end loop;
  k := public._vp_cat(v_cards);
  mult := (c.pays->>k)::int;
  pay := bet * mult;
  if pay > 0 then update public.pstate set bananas = bananas + pay where uid = u; end if;
  update public.mf_vp set hand = null, total = total + 1 where uid = u;
  joker := v_cards @> '[52]'::jsonb;

  perform public._vp_log(u, 'Mise ' || bet || ' 🍌 · ' || public._vp_name(k) || case when joker then ' (Joker 🐒)' else '' end ||
    case when pay > 0 then ' · +' || (pay - bet) || ' 🍌' else '' end);
  if k >= 7 then   -- carré ou mieux : annoncé dans le fil
    perform public._feed(jsonb_build_object('kind', 'vp', 'uid', u, 'r', k, 'v', pay - bet, 'j', joker));
  end if;

  return jsonb_build_object('done', true, 'c', v_cards, 'cat', k, 'name', public._vp_name(k), 'bet', bet, 'mult', mult,
    'pay', pay, 'net', pay - bet, 'info', public._vp_info(u));
end $$;

-- admin : 'reset' (rend les mains du jour et annule la main en cours), 'bananas' (+50 🍌 pour soi), 'open' / 'close'
create or replace function public.mf_vp_admin(p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  insert into public.mf_vp(uid) values (u) on conflict do nothing;
  if p_action = 'reset' then
    update public.mf_vp set nb = 0, hand = null where uid = u;
  elsif p_action = 'bananas' then
    update public.pstate set bananas = bananas + 50 where uid = u;
  elsif p_action = 'open' then
    update public.mf_vp_cfg set open = true where id = 1;
  elsif p_action = 'close' then
    update public.mf_vp_cfg set open = false where id = 1;
  end if;
  return public._vp_info(u);
end $$;

-- les fonctions internes ne s'appellent pas depuis le site
revoke execute on function public._vp_cat5(int[]), public._vp_cat(jsonb), public._vp_name(int), public._vp_info(uuid), public._vp_log(uuid, text)
  from public, anon, authenticated;
revoke execute on function public.mf_vp_open(), public.mf_vp_status(), public.mf_vp_deal(int, text), public.mf_vp_draw(int[]), public.mf_vp_admin(text) from public, anon;
grant execute on function public.mf_vp_open(), public.mf_vp_status(), public.mf_vp_deal(int, text), public.mf_vp_draw(int[]),
  public.mf_vp_admin(text) to authenticated;
