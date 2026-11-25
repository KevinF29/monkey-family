-- Monkey Family — The Monkey Wheel (roue de la fortune du Casino)
-- À lancer une seule fois dans Supabase. Ne touche à aucune table existante :
-- crée deux tables (mf_wheel, mf_wheel_cfg) et les fonctions mf_wheel_*.
-- La roue reste visible par l'admin seulement tant que mf_wheel_cfg.open = false
-- (bouton « Ouvrir à tous » dans les réglages admin de la roue).
--
-- Règles :
--  - 1 tour gratuit par jour sur la roue dorée (heure de Paris, non cumulable)
--  - tours payants sur la roue normale : 1 🍌, 5 par jour (réglables dans mf_wheel_cfg) ;
--    la banane de chaque tour payant va dans la cagnotte commune à tous les joueurs
--  - lots : bananes, relance (tour gratuit sur la roue normale), −2 h d'attente, 2 boosters, jackpot (= la cagnotte, qui repart à 20)
--  - gains de 1, 2, 5 et 10 🍌 : le joueur choisit de les garder ou de tenter un quitte ou double (roue or/noir, une chance sur deux)
--  - Monkey Scam : 1 % de chances, sur chaque tour gagnant et sur un quitte ou double réussi, qu'un singe vole le lot (rien n'est crédité)
--  - l'ordre des cases ci-dessous doit rester celui de wheel.js : la page fait tourner la roue jusqu'à la case renvoyée par le serveur

create table if not exists public.mf_wheel (
  uid uuid primary key,
  free_day date,                -- dernier jour où le tour doré a été pris
  paid_day date,                -- jour du compteur paid_n
  paid_n int not null default 0,
  relance int not null default 0,
  pending jsonb,                -- gain en attente du choix « garder / quitte ou double »
  hist jsonb not null default '[]'::jsonb,  -- 10 derniers tours (texte)
  total int not null default 0
);
alter table public.mf_wheel enable row level security;   -- aucune politique : on passe uniquement par les fonctions

create table if not exists public.mf_wheel_cfg (
  id int primary key default 1 check (id = 1),
  open boolean not null default false,
  price int not null default 1,
  paid_max int not null default 5,
  pot int not null default 20,          -- cagnotte commune
  pot0 int not null default 20,         -- montant de départ de la cagnotte
  scam numeric not null default 0.01    -- chance de Monkey Scam
);
alter table public.mf_wheel_cfg enable row level security;
insert into public.mf_wheel_cfg(id) values (1) on conflict do nothing;

-- les cases de chaque roue, dans l'ordre (même ordre que dans wheel.js)
create or replace function public._wheel_seg(w text)
returns text[] language sql immutable set search_path = public as $$
  select case w
    when 'gold' then string_to_array('J P b2 b5 b2 T b10 b2 P b5 BB b2 b25 b5 P b2 b10 b5 b2 P', ' ')
    when 'qod'  then string_to_array('OR NO OR NO OR NO OR NO OR NO', ' ')
    else             string_to_array('J P b1 P b5 P T P P P b1 R P b10 P b1 P BB P b2 P P P b1', ' ')
  end $$;

-- une case : {t: lose|ban|relance|time|boost|jackpot, v, lab}
create or replace function public._wheel_prize(k text)
returns jsonb language sql immutable set search_path = public as $$
  select case
    when k = 'P' then '{"t":"lose","v":0,"lab":"Perdu"}'::jsonb
    when k ~ '^b[0-9]+$' then jsonb_build_object('t', 'ban', 'v', substr(k, 2)::int, 'lab', substr(k, 2) || ' 🍌')
    when k = 'R' then '{"t":"relance","v":1,"lab":"Relance"}'::jsonb
    when k = 'T' then '{"t":"time","v":120,"lab":"−2 h d''attente"}'::jsonb
    when k = 'BB' then '{"t":"boost","v":2,"lab":"2 boosters"}'::jsonb
    when k = 'J' then '{"t":"jackpot","v":0,"lab":"le jackpot"}'::jsonb
    else '{"t":"lose","v":0,"lab":"Perdu"}'::jsonb
  end $$;

-- tirer une case (au hasard, ou parmi les cases « k » si l'admin force un résultat) ; renvoie l'index, compté à partir de 0
create or replace function public._wheel_pick(w text, k text)
returns int language plpgsql volatile set search_path = public as $$
declare s text[] := public._wheel_seg(w); ix int[];
begin
  if k is not null then
    select array_agg(i - 1) into ix from generate_subscripts(s, 1) i where s[i] = k;
    if ix is not null then return ix[1 + floor(random() * cardinality(ix))::int]; end if;
  end if;
  return floor(random() * cardinality(s))::int;
end $$;

create or replace function public._wheel_info(p_uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.mf_wheel_cfg; t public.mf_wheel; d date := (now() at time zone 'Europe/Paris')::date;
begin
  select * into c from public.mf_wheel_cfg where id = 1;
  select * into t from public.mf_wheel where uid = p_uid;
  return jsonb_build_object(
    'open', coalesce(c.open, false), 'price', coalesce(c.price, 1), 'max', coalesce(c.paid_max, 5),
    'pot', coalesce(c.pot, 20), 'pot0', coalesce(c.pot0, 20),
    'free', t.free_day is distinct from d,
    'paidLeft', greatest(0, coalesce(c.paid_max, 5) - case when t.paid_day = d then t.paid_n else 0 end),
    'relance', coalesce(t.relance, 0),
    'pending', t.pending,
    'hist', coalesce(t.hist, '[]'::jsonb),
    'nextFree', (extract(epoch from ((d + 1)::timestamp at time zone 'Europe/Paris')) * 1000)::bigint,
    'now', (extract(epoch from now()) * 1000)::bigint,
    'segs', jsonb_build_object('main', to_jsonb(public._wheel_seg('main')), 'gold', to_jsonb(public._wheel_seg('gold'))),
    'state', public._state(p_uid));
end $$;

-- garde les 10 derniers tours
create or replace function public._wheel_log(p_uid uuid, txt text)
returns void language sql security definer set search_path = public as $$
  update public.mf_wheel set hist = (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select x from jsonb_array_elements(jsonb_build_array(txt) || hist) with ordinality a(x, o) order by o limit 10) z)
  where uid = p_uid $$;

-- la roue est-elle visible pour tous ?
create or replace function public.mf_wheel_open()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select open from public.mf_wheel_cfg where id = 1), false) $$;

create or replace function public.mf_wheel_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  if not public.mf_wheel_open() and not public.is_admin() then raise exception 'wheel_closed'; end if;
  insert into public.mf_wheel(uid) values (u) on conflict do nothing;
  perform public._tick(u);
  return public._wheel_info(u);
end $$;

-- donner un lot (bananes, relance, minutes d'attente en moins, boosters, jackpot) ; renvoie {kept} pour le temps gardé en réserve
create or replace function public._wheel_give(p_uid uuid, t text, v int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.pstate; kept boolean := false;
begin
  select * into s from public.pstate where uid = p_uid for update;
  if t in ('ban', 'jackpot') then
    update public.pstate set bananas = bananas + v where uid = p_uid;
  elsif t = 'boost' then
    update public.pstate set stock = least(99, stock + v) where uid = p_uid;
  elsif t = 'relance' then
    update public.mf_wheel set relance = relance + v where uid = p_uid;
  elsif t = 'time' then
    kept := s.next_at is null or s.stock >= 3;
    if not kept then
      update public.pstate set next_at = next_at - make_interval(mins => v) where uid = p_uid;
    else
      update public.pstate set slot_bank = least(1440, slot_bank + v) where uid = p_uid;
    end if;
    perform public._tick(p_uid);
  end if;
  return jsonb_build_object('kept', kept);
end $$;

-- texte d'un lot pour l'historique
create or replace function public._wheel_lab(t text, v int)
returns text language sql immutable set search_path = public as $$
  select case t when 'ban' then v || ' 🍌' when 'jackpot' then 'jackpot ' || v || ' 🍌' when 'boost' then v || ' boosters'
    when 'relance' then v || case when v > 1 then ' relances' else ' relance' end when 'time' then '−' || (v / 60) || ' h d''attente' else '' end $$;

-- les beaux lots partent dans le fil d'actu (d = gagné au quitte ou double)
create or replace function public._wheel_feed(p_uid uuid, t text, v int, d boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if t in ('boost', 'time', 'jackpot') or (t = 'ban' and (v >= 25 or (d and v >= 20))) or (t = 'relance' and d) then
    perform public._feed(jsonb_build_object('kind', 'wheel', 'uid', p_uid, 'r', t, 'v', v, 'd', d));
  end if;
end $$;

-- un tour : p_kind = 'gold' (tour doré du jour), 'paid' (tour payant) ou 'relance' ; tout lot gagné attend le choix garder / quitte ou double
create or replace function public.mf_wheel_spin(p_kind text default 'paid', p_force text default null, p_scam boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_wheel_cfg; t public.mf_wheel; s public.pstate;
  d date := (now() at time zone 'Europe/Paris')::date; n int; w text; src text; idx int; k text; p jsonb; tt text; v int;
  sc boolean; adm boolean := public.is_admin();
begin
  if not public.mf_wheel_open() and not adm then raise exception 'wheel_closed'; end if;
  insert into public.mf_wheel(uid) values (u) on conflict do nothing;
  select * into t from public.mf_wheel where uid = u for update;
  if t.pending is not null then raise exception 'wheel_pending'; end if;
  perform public._tick(u);
  select * into s from public.pstate where uid = u for update;
  select * into c from public.mf_wheel_cfg where id = 1 for update;
  n := case when t.paid_day = d then t.paid_n else 0 end;

  if p_kind = 'gold' then
    if t.free_day = d then raise exception 'wheel_free_used'; end if;
    w := 'gold'; src := 'Tour doré';
    update public.mf_wheel set free_day = d where uid = u;
  elsif p_kind = 'relance' then
    if t.relance < 1 then raise exception 'wheel_no_relance'; end if;
    w := 'main'; src := 'Relance';
    update public.mf_wheel set relance = relance - 1 where uid = u;
  else
    if n >= c.paid_max then raise exception 'wheel_limit'; end if;
    if s.bananas < c.price then raise exception 'no_bananas'; end if;
    w := 'main'; src := 'Tour payant';
    update public.pstate set bananas = bananas - c.price where uid = u;
    c.pot := c.pot + c.price;
    update public.mf_wheel set paid_day = d, paid_n = n + 1 where uid = u;
  end if;

  idx := public._wheel_pick(w, case when adm then nullif(p_force, '') end);
  k := (public._wheel_seg(w))[idx + 1];
  p := public._wheel_prize(k); tt := p->>'t'; v := (p->>'v')::int;
  sc := tt <> 'lose' and ((adm and coalesce(p_scam, false)) or random() < c.scam);
  if tt = 'jackpot' and not sc then v := c.pot; c.pot := c.pot0; end if;   -- la cagnotte est prise : elle repart à zéro, même si le quitte ou double est perdu ensuite

  if sc then
    perform public._feed(jsonb_build_object('kind', 'wheel_scam', 'uid', u, 'lab', p->>'lab'));
    perform public._wheel_log(u, src || ' · Monkey Scam ! ' || (p->>'lab') || ' volé');
  elsif tt = 'lose' then
    perform public._wheel_log(u, src || ' · Perdu');
  else
    -- tout lot gagné attend le choix « garder » ou « quitte ou double »
    update public.mf_wheel set pending = jsonb_build_object('stage', 'choice', 't', tt, 'v', v, 'key', k) where uid = u;
    perform public._wheel_log(u, src || ' · ' || public._wheel_lab(tt, v));
  end if;
  update public.mf_wheel_cfg set pot = c.pot where id = 1;
  update public.mf_wheel set total = total + 1 where uid = u;
  return jsonb_build_object('wheel', w, 'idx', idx, 'key', k, 'gain', case when sc or tt = 'lose' then 0 else v end, 'scam', sc, 'info', public._wheel_info(u));
end $$;

-- après un lot gagné : p_double = false pour le garder, true pour le quitte ou double (le lot doublé ou rien)
create or replace function public.mf_wheel_double(p_double boolean default false, p_force text default null, p_scam boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_wheel_cfg; t public.mf_wheel; tt text; v int; idx int; k text; won boolean; sc boolean := false;
  adm boolean := public.is_admin(); g jsonb;
begin
  select * into t from public.mf_wheel where uid = u for update;
  if t.pending is null or t.pending->>'stage' <> 'choice' then raise exception 'wheel_nothing'; end if;
  tt := coalesce(t.pending->>'t', 'ban'); v := coalesce((t.pending->>'v')::int, (t.pending->>'gain')::int);   -- ancien format {gain}
  update public.mf_wheel set pending = null where uid = u;
  if not coalesce(p_double, false) then
    g := public._wheel_give(u, tt, v);
    perform public._wheel_feed(u, tt, v, false);
    perform public._wheel_log(u, 'Gardé · ' || public._wheel_lab(tt, v));
    return jsonb_build_object('kept', true, 't', tt, 'v', v, 'gain', v, 'timeKept', g->'kept', 'info', public._wheel_info(u));
  end if;
  select * into c from public.mf_wheel_cfg where id = 1;
  idx := public._wheel_pick('qod', case when adm then nullif(p_force, '') end);
  k := (public._wheel_seg('qod'))[idx + 1];
  won := k = 'OR';
  sc := won and ((adm and coalesce(p_scam, false)) or random() < c.scam);
  if won and not sc then
    g := public._wheel_give(u, tt, 2 * v);
    perform public._wheel_feed(u, tt, 2 * v, true);
  end if;
  if sc then perform public._feed(jsonb_build_object('kind', 'wheel_scam', 'uid', u, 'lab', public._wheel_lab(tt, 2 * v))); end if;
  perform public._wheel_log(u, 'Quitte ou double · ' || case when sc then 'Monkey Scam ! ' || public._wheel_lab(tt, 2 * v) || ' volé' when won then 'doublé, ' || public._wheel_lab(tt, 2 * v) else 'perdu ' || public._wheel_lab(tt, v) end);
  return jsonb_build_object('wheel', 'qod', 'idx', idx, 'key', k, 't', tt, 'v', v, 'gain', case when won and not sc then 2 * v else 0 end, 'stake', v, 'scam', sc,
    'timeKept', coalesce(g->'kept', 'false'::jsonb), 'info', public._wheel_info(u));
end $$;


revoke execute on function public._wheel_give(uuid, text, int), public._wheel_lab(text, int), public._wheel_feed(uuid, text, int, boolean) from public, anon, authenticated;

-- admin : 'reset' (rend le tour doré et les tours payants du jour), 'bananas' (+50 🍌 pour soi), 'pot' (cagnotte +50),
-- 'open' / 'close' (visible par tous ou non)
create or replace function public.mf_wheel_admin(p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  insert into public.mf_wheel(uid) values (u) on conflict do nothing;
  if p_action = 'reset' then
    update public.mf_wheel set free_day = null, paid_n = 0, pending = null where uid = u;
  elsif p_action = 'bananas' then
    update public.pstate set bananas = bananas + 50 where uid = u;
  elsif p_action = 'pot' then
    update public.mf_wheel_cfg set pot = pot + 50 where id = 1;
  elsif p_action = 'open' then
    update public.mf_wheel_cfg set open = true where id = 1;
  elsif p_action = 'close' then
    update public.mf_wheel_cfg set open = false where id = 1;
  end if;
  return public._wheel_info(u);
end $$;

-- les fonctions internes ne s'appellent pas depuis le site
revoke execute on function public._wheel_seg(text), public._wheel_prize(text), public._wheel_pick(text, text),
  public._wheel_info(uuid), public._wheel_log(uuid, text) from public, anon, authenticated;
revoke execute on function public.mf_wheel_status(), public.mf_wheel_spin(text, text, boolean),
  public.mf_wheel_double(boolean, text, boolean), public.mf_wheel_admin(text) from public, anon;
grant execute on function public.mf_wheel_open(), public.mf_wheel_status(), public.mf_wheel_spin(text, text, boolean),
  public.mf_wheel_double(boolean, text, boolean), public.mf_wheel_admin(text) to authenticated;
