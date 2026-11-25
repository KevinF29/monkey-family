-- Monkey Family — Banana Jack (blackjack du Casino, avec un singe croupier)
-- À lancer une seule fois dans Supabase. Ne touche à aucune table existante :
-- crée deux tables (mf_bj, mf_bj_cfg) et les fonctions mf_bj_*.
-- Le jeu reste visible par l'admin seulement tant que mf_bj_cfg.open = false
-- (bouton « Ouvrir à tous » dans les réglages admin du jeu).
--
-- Règles :
--  - 10 mains par jour (heure de Paris), mise de 1 à 20 🍌 (réglables dans mf_bj_cfg)
--  - actions : tirer, rester, doubler (sur les 2 premières cartes : mise doublée, une seule carte de plus)
--  - le croupier tire jusqu'à 17 et reste sur tous les 17 ; s'il a un blackjack d'entrée, la main s'arrête tout de suite
--  - paiements (ce qui revient au joueur) : gagné = 2× la mise, égalité = la mise, blackjack = mise + 1,5× la mise (arrondi au-dessus),
--    Monkey Blackjack (As + Roi singe d'entrée) = 5× la mise (mf_bj_cfg.mpay)
--  - croupier tricheur : quand le singe devrait sauter, il a mf_bj_cfg.cheat (8 %) de chances de sortir de sa manche
--    la carte qui lui fait 21 ; c'est annoncé dans le fil d'actu
--  - sabot infini : chaque carte est tirée au hasard parmi 52 (0..51 ; rang = c % 13 : 0 = As, 1..8 = 2..9, 9 = 10, 10 V, 11 D, 12 R ;
--    couleur = c / 13 : ♠ ♥ ♦ ♣)
--  - la carte cachée du croupier n'est jamais envoyée à la page avant la fin de la main

create table if not exists public.mf_bj (
  uid uuid primary key,
  day date,                     -- jour du compteur n
  n int not null default 0,     -- mains jouées ce jour-là
  hand jsonb,                   -- main en cours {bet, p, d, dbl, fb, fc}
  hist jsonb not null default '[]'::jsonb,  -- 10 dernières mains (texte)
  total int not null default 0
);
alter table public.mf_bj enable row level security;   -- aucune politique : on passe uniquement par les fonctions

create table if not exists public.mf_bj_cfg (
  id int primary key default 1 check (id = 1),
  open boolean not null default false,
  min_bet int not null default 1,
  max_bet int not null default 20,
  hands int not null default 10,
  mpay int not null default 5,           -- Monkey Blackjack : la mise × mpay revient au joueur
  cheat numeric not null default 0.08    -- chance que le singe triche quand il devrait sauter
);
alter table public.mf_bj_cfg enable row level security;
insert into public.mf_bj_cfg(id) values (1) on conflict do nothing;

-- total d'une main (les As valent 11 ou 1)
create or replace function public._bj_total(h jsonb)
returns int language plpgsql immutable set search_path = public as $$
declare t int := 0; a int := 0; c int; r int;
begin
  for c in select jsonb_array_elements_text(coalesce(h, '[]'::jsonb))::int loop
    r := c % 13;
    if r = 0 then t := t + 11; a := a + 1; elsif r >= 9 then t := t + 10; else t := t + r + 1; end if;
  end loop;
  while t > 21 and a > 0 loop t := t - 10; a := a - 1; end loop;
  return t;
end $$;

create or replace function public._bj_card() returns int language sql volatile as $$ select floor(random() * 52)::int $$;
create or replace function public._bj_is_bj(h jsonb) returns boolean language sql immutable set search_path = public as $$
  select jsonb_array_length(h) = 2 and public._bj_total(h) = 21 $$;
create or replace function public._bj_is_monkey(h jsonb) returns boolean language sql immutable set search_path = public as $$
  select public._bj_is_bj(h) and exists(select 1 from jsonb_array_elements_text(h) x where x::int % 13 = 12) $$;

create or replace function public._bj_info(p_uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.mf_bj_cfg; t public.mf_bj; d date := (now() at time zone 'Europe/Paris')::date; h jsonb;
begin
  select * into c from public.mf_bj_cfg where id = 1;
  select * into t from public.mf_bj where uid = p_uid;
  if t.hand is not null then   -- on cache la deuxième carte du croupier
    h := jsonb_build_object('bet', t.hand->'bet', 'dbl', coalesce(t.hand->'dbl', 'false'::jsonb), 'p', t.hand->'p', 'd', jsonb_build_array(t.hand->'d'->0));
  end if;
  return jsonb_build_object(
    'open', coalesce(c.open, false), 'min', c.min_bet, 'maxBet', c.max_bet, 'max', c.hands, 'mpay', c.mpay,
    'left', greatest(0, c.hands - case when t.day = d then t.n else 0 end),
    'hand', h,
    'hist', coalesce(t.hist, '[]'::jsonb),
    'nextDay', (extract(epoch from ((d + 1)::timestamp at time zone 'Europe/Paris')) * 1000)::bigint,
    'now', (extract(epoch from now()) * 1000)::bigint,
    'state', public._state(p_uid));
end $$;

create or replace function public._bj_log(p_uid uuid, txt text)
returns void language sql security definer set search_path = public as $$
  update public.mf_bj set hist = (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select x from jsonb_array_elements(jsonb_build_array(txt) || hist) with ordinality a(x, o) order by o limit 10) z)
  where uid = p_uid $$;

-- le jeu est-il ouvert à tous ? (et dans les jeux de la semaine si on l'ajoute un jour à la rotation du Casino)
create or replace function public.mf_bj_open()
returns boolean language sql security definer set search_path = public as $$
  select coalesce((select open from public.mf_bj_cfg where id = 1), false) and public._casino_on('bj') $$;

create or replace function public.mf_bj_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  if not public.mf_bj_open() and not public.is_admin() then raise exception 'bj_closed'; end if;
  insert into public.mf_bj(uid) values (u) on conflict do nothing;
  return public._bj_info(u);
end $$;

-- fin de la main : le croupier joue (sauf si le joueur a sauté ou si un blackjack a tout réglé), on paie, on annonce
create or replace function public._bj_finish(p_uid uuid, h jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.mf_bj_cfg; p jsonb := h->'p'; d jsonb := h->'d'; bet int := (h->>'bet')::int;
  pt int := public._bj_total(h->'p'); dt int; k int; need int; res text; pay int := 0; cheat boolean := false; ci int;
  nat boolean := coalesce((h->>'nat')::boolean, false); txt text;
begin
  select * into c from public.mf_bj_cfg where id = 1;
  if public._bj_is_bj(d) then
    res := case when public._bj_is_bj(p) then 'push' else 'dealer_bj' end;
  elsif nat and public._bj_is_monkey(p) then
    res := 'monkey';
  elsif nat and public._bj_is_bj(p) then
    res := 'bj';
  elsif pt > 21 then
    res := 'bust';
  else
    loop
      dt := public._bj_total(d);
      exit when dt >= 17;
      k := case when coalesce((h->>'fb')::boolean, false) then 9 + 13 * floor(random() * 4)::int else public._bj_card() end;   -- admin : le croupier saute
      h := h - 'fb';
      if public._bj_total(d || to_jsonb(k)) > 21 and (coalesce((h->>'fc')::boolean, false) or random() < c.cheat) then
        -- le singe sort de sa manche la carte qui lui fait 21
        need := 21 - dt;
        k := (case when need >= 10 then 9 + floor(random() * 4)::int else need - 1 end) + 13 * floor(random() * 4)::int;
        cheat := true; ci := jsonb_array_length(d);
      end if;
      d := d || to_jsonb(k);
    end loop;
    dt := public._bj_total(d);
    res := case when dt > 21 or pt > dt then 'win' when pt = dt then 'push' else 'lose' end;
  end if;

  pay := case res when 'win' then 2 * bet when 'push' then bet when 'bj' then bet + ceil(1.5 * bet)::int when 'monkey' then c.mpay * bet else 0 end;
  if pay > 0 then update public.pstate set bananas = bananas + pay where uid = p_uid; end if;
  update public.mf_bj set hand = null, total = total + 1 where uid = p_uid;

  txt := 'Mise ' || bet || ' 🍌 · ' || pt || ' contre ' || public._bj_total(d) || ' · ' ||
    case res when 'win' then 'gagné +' || (pay - bet) when 'push' then 'égalité' when 'bj' then 'Blackjack ! +' || (pay - bet)
      when 'monkey' then 'MONKEY BLACKJACK ! +' || (pay - bet) when 'bust' then 'sauté' when 'dealer_bj' then 'blackjack du singe' else 'perdu' end ||
    case when res in ('win', 'bj', 'monkey') then ' 🍌' else '' end || case when cheat then ' · le singe a triché 🃏' else '' end;
  perform public._bj_log(p_uid, txt);

  if res = 'monkey' or (pay - bet >= 30) then
    perform public._feed(jsonb_build_object('kind', 'bj', 'uid', p_uid, 'r', res, 'v', pay - bet, 'dbl', coalesce(h->'dbl', 'false'::jsonb)));
  end if;
  if cheat then perform public._feed(jsonb_build_object('kind', 'bj_cheat', 'uid', p_uid, 'v', bet)); end if;

  return jsonb_build_object('done', true, 'p', p, 'd', d, 'bet', bet, 'pt', pt, 'dt', public._bj_total(d), 'out', res,
    'pay', pay, 'net', pay - bet, 'cheat', cheat, 'ci', ci, 'dbl', coalesce(h->'dbl', 'false'::jsonb), 'info', public._bj_info(p_uid));
end $$;

-- nouvelle main. Admin seulement : p_force = 'monkey' | 'bj' | 'dealer' | 'bust' (le croupier va sauter), p_cheat = le singe triche s'il saute
create or replace function public.mf_bj_deal(p_bet int, p_force text default null, p_cheat boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_bj_cfg; t public.mf_bj; s public.pstate; d date := (now() at time zone 'Europe/Paris')::date;
  n int; adm boolean := public.is_admin(); f text := case when adm then nullif(p_force, '') end; p jsonb; dl jsonb; h jsonb; ac int := floor(random() * 4)::int;
begin
  if not public.mf_bj_open() and not adm then raise exception 'bj_closed'; end if;
  insert into public.mf_bj(uid) values (u) on conflict do nothing;
  select * into t from public.mf_bj where uid = u for update;
  if t.hand is not null then raise exception 'bj_in_hand'; end if;
  select * into c from public.mf_bj_cfg where id = 1;
  n := case when t.day = d then t.n else 0 end;
  if n >= c.hands then raise exception 'bj_limit'; end if;
  if p_bet is null or p_bet < c.min_bet or p_bet > c.max_bet then raise exception 'bj_bet'; end if;
  select * into s from public.pstate where uid = u for update;
  if s.bananas < p_bet then raise exception 'no_bananas'; end if;
  update public.pstate set bananas = bananas - p_bet where uid = u;
  update public.mf_bj set day = d, n = n + 1 where uid = u;

  p := jsonb_build_array(public._bj_card(), public._bj_card());
  dl := jsonb_build_array(public._bj_card(), public._bj_card());
  if f = 'monkey' then p := jsonb_build_array(13 * ac, 12 + 13 * ((ac + 1) % 4)); dl := jsonb_build_array(5, 20);
  elsif f = 'bj' then p := jsonb_build_array(13 * ac, 9 + 13 * ((ac + 2) % 4)); dl := jsonb_build_array(5, 20);
  elsif f = 'dealer' then dl := jsonb_build_array(13 * ac, 11 + 13 * ((ac + 1) % 4)); p := jsonb_build_array(6, 22);
  elsif f = 'bust' then p := jsonb_build_array(9, 23); dl := jsonb_build_array(5, 35);
  end if;
  h := jsonb_build_object('bet', p_bet, 'p', p, 'd', dl, 'dbl', false, 'fb', f = 'bust', 'fc', adm and coalesce(p_cheat, false));

  -- blackjack d'entrée (joueur ou croupier) : la main se règle tout de suite
  if public._bj_is_bj(p) or public._bj_is_bj(dl) then
    return public._bj_finish(u, h || '{"nat":true}'::jsonb);
  end if;
  update public.mf_bj set hand = h where uid = u;
  return jsonb_build_object('done', false, 'info', public._bj_info(u));
end $$;

-- action sur la main en cours : 'hit' (tirer), 'stand' (rester), 'double' (doubler)
create or replace function public.mf_bj_act(p_act text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); t public.mf_bj; s public.pstate; h jsonb; bet int; pt int;
begin
  select * into t from public.mf_bj where uid = u for update;
  if t.hand is null then raise exception 'bj_no_hand'; end if;
  h := t.hand; bet := (h->>'bet')::int;
  if p_act = 'stand' then
    return public._bj_finish(u, h);
  elsif p_act = 'double' then
    if jsonb_array_length(h->'p') <> 2 then raise exception 'bj_no_double'; end if;
    select * into s from public.pstate where uid = u for update;
    if s.bananas < bet then raise exception 'no_bananas'; end if;
    update public.pstate set bananas = bananas - bet where uid = u;
    h := jsonb_set(jsonb_set(h, '{bet}', to_jsonb(2 * bet)), '{dbl}', 'true'::jsonb);
    h := jsonb_set(h, '{p}', (h->'p') || to_jsonb(public._bj_card()));
    return public._bj_finish(u, h);
  elsif p_act = 'hit' then
    h := jsonb_set(h, '{p}', (h->'p') || to_jsonb(public._bj_card()));
    pt := public._bj_total(h->'p');
    if pt >= 21 then return public._bj_finish(u, h); end if;   -- sauté, ou 21 : on passe la main au singe
    update public.mf_bj set hand = h where uid = u;
    return jsonb_build_object('done', false, 'info', public._bj_info(u));
  end if;
  raise exception 'bj_bad_action';
end $$;

-- admin : 'reset' (rend les mains du jour et annule la main en cours), 'bananas' (+50 🍌 pour soi), 'open' / 'close'
create or replace function public.mf_bj_admin(p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  insert into public.mf_bj(uid) values (u) on conflict do nothing;
  if p_action = 'reset' then
    update public.mf_bj set n = 0, hand = null where uid = u;
  elsif p_action = 'bananas' then
    update public.pstate set bananas = bananas + 50 where uid = u;
  elsif p_action = 'open' then
    update public.mf_bj_cfg set open = true where id = 1;
  elsif p_action = 'close' then
    update public.mf_bj_cfg set open = false where id = 1;
  end if;
  return public._bj_info(u);
end $$;

-- les fonctions internes ne s'appellent pas depuis le site
revoke execute on function public._bj_total(jsonb), public._bj_card(), public._bj_is_bj(jsonb), public._bj_is_monkey(jsonb),
  public._bj_info(uuid), public._bj_log(uuid, text), public._bj_finish(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.mf_bj_status(), public.mf_bj_deal(int, text, boolean), public.mf_bj_act(text), public.mf_bj_admin(text) from public, anon;
grant execute on function public.mf_bj_open(), public.mf_bj_status(), public.mf_bj_deal(int, text, boolean),
  public.mf_bj_act(text), public.mf_bj_admin(text) to authenticated;
