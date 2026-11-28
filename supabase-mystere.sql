-- Monkey Family — Le Singe Mystère (apparaît dans les jeux du Casino, sauf Monkey Run)
-- À lancer une seule fois dans Supabase (installé le 27/11/2026).
--
-- Règles :
--  - à chaque partie, 0,5 % de chances (1 % au lancement, baissé le 28/11) (mf_mys_cfg.chance) qu'il apparaisse ;
--  - anti-frustration : chaque joueur a, pour chaque jeu, un compteur de perte nette (mises − gains) depuis la dernière
--    visite du singe ; quand il atteint le seuil du jeu (mf_mys_cfg.threshold), le singe vient à coup sûr à la partie suivante ;
--  - au plus une visite par joueur, par jeu et par jour (heure de Paris) ;
--  - les lots non bananes comptent dans le compteur : booster 10 🍌, booster de rareté 30 🍌, temps 5 🍌, relance 1 🍌 ;
--  - il fait gagner un gros lot (jamais le jackpot) et annonce ce qu'il fait (champ « mys » renvoyé à la page) ;
--  - la Banana Machine n'a plus son « singe qui a pitié » (+10 🍌) : le Singe Mystère le remplace ;
--  - l'admin peut forcer sa venue à sa prochaine partie d'un jeu (mf_mys_admin('force', jeu)) ; rien dans le fil pour l'admin.
--
-- Ce qu'il fait :
--  slot  Banana Machine   triple « Planquez vos mamans » (+40 🍌)
--  scratch Monkey Cash    ticket gagnant « Planquez vos mamans » (+25 🍌)
--  wheel The Monkey Wheel  la roue s'arrête sur 10 🍌 (tour doré : 25 🍌), pas de Monkey Scam
--  mine  Champ de Cocos   les 5 prochaines cocos sont sans serpent
--  tour  Monkey Tower     aucune porte piégée sur les 3 prochains étages
--  vp    Poker Monkey     main finale transformée en full (seulement si la main faisait moins qu'un full)
--  coco  Crash Cocotier   le cocotier tient au moins jusqu'à ×5
--  pk    Plinko Banana    la bille tombe dans une case 20 🍌
--  bon   Bananateau       pas de triche, gain doublé si la banane est trouvée
--  bj    MonkeyJack 21    Blackjack d'entrée (As + 10, Valet ou Dame)

create table if not exists public.mf_mys_cfg (
  game text primary key,
  threshold int not null,             -- perte nette (🍌) qui fait venir le singe à coup sûr
  chance numeric not null default 0.005,
  enabled boolean not null default true
);
alter table public.mf_mys_cfg enable row level security;
insert into public.mf_mys_cfg(game, threshold) values
  ('slot', 10), ('scratch', 20), ('wheel', 12), ('mine', 30), ('tour', 25),
  ('vp', 30), ('coco', 30), ('pk', 20), ('bon', 20), ('bj', 40)
on conflict do nothing;

create table if not exists public.mf_mys (
  uid uuid not null,
  game text not null,
  loss int not null default 0,        -- perte nette depuis la dernière visite
  day date,                           -- jour de la dernière visite
  force boolean not null default false,
  visits int not null default 0,
  primary key (uid, game)
);
alter table public.mf_mys enable row level security;

-- valeur en bananes d'un lot
create or replace function public._mys_val(t text, v int)
returns int language sql immutable set search_path = public as $$
  select case t when 'ban' then coalesce(v, 0) when 'jackpot' then coalesce(v, 0) when 'boost' then 10 * coalesce(v, 0)
    when 'time' then 5 when 'relance' then 1 when 'rpack' then 30 when 'rwheel' then 30 else 0 end $$;

-- ajoute le résultat net d'une partie (positif = gagné) au compteur de perte
create or replace function public._mys_add(p_uid uuid, p_game text, p_net int)
returns void language sql security definer set search_path = public as $$
  insert into public.mf_mys(uid, game, loss) values (p_uid, p_game, greatest(0, -p_net))
  on conflict (uid, game) do update set loss = greatest(0, public.mf_mys.loss - p_net) $$;

-- le singe vient-il à cette partie ? (enregistre sa visite)
create or replace function public._mys_roll(p_uid uuid, p_game text)
returns boolean language plpgsql security definer set search_path = public as $$
declare c public.mf_mys_cfg; m public.mf_mys; d date := (now() at time zone 'Europe/Paris')::date; hit boolean;
begin
  select * into c from public.mf_mys_cfg where game = p_game;
  if not found or not c.enabled then return false; end if;
  insert into public.mf_mys(uid, game) values (p_uid, p_game) on conflict do nothing;
  select * into m from public.mf_mys where uid = p_uid and game = p_game for update;
  if m.force then hit := true;
  elsif m.day = d then return false;
  else hit := m.loss >= c.threshold or random() < c.chance;
  end if;
  if hit then
    update public.mf_mys set force = false, day = d, loss = 0, visits = visits + 1 where uid = p_uid and game = p_game;
    perform public._feed(jsonb_build_object('kind', 'mys', 'uid', p_uid, 'g', p_game));
  end if;
  return hit;
end $$;

-- Poker : transforme la main finale en full en gardant le plus possible des cartes gardées
create or replace function public._mys_vp_full(p_old jsonb, p_hold int[])
returns jsonb language plpgsql set search_path = public as $$
declare cnt int[] := array_fill(0, array[13]); i int; x int; r3 int; r2 int; rk int;
  res int[] := array[-1, -1, -1, -1, -1]; used int[] := '{}'; n3 int := 3; n2 int := 2; hd int[] := coalesce(p_hold, '{}');
begin
  for i in 0..4 loop
    if i = any(hd) then x := (p_old->>i)::int; if x < 52 then cnt[x % 13 + 1] := cnt[x % 13 + 1] + 1; end if; end if;
  end loop;
  select g into r3 from generate_series(0, 12) g where cnt[g + 1] > 0 order by cnt[g + 1] desc, random() limit 1;
  if r3 is null then r3 := floor(random() * 13)::int; end if;
  select g into r2 from generate_series(0, 12) g where cnt[g + 1] > 0 and g <> r3 order by cnt[g + 1] desc, random() limit 1;
  if r2 is null then r2 := (r3 + 1 + floor(random() * 12)::int) % 13; end if;
  for i in 0..4 loop
    if i = any(hd) then
      x := (p_old->>i)::int;
      if x < 52 and x % 13 = r3 and n3 > 0 then res[i + 1] := x; n3 := n3 - 1; used := used || x;
      elsif x < 52 and x % 13 = r2 and n2 > 0 then res[i + 1] := x; n2 := n2 - 1; used := used || x;
      end if;
    end if;
  end loop;
  for i in 1..5 loop
    if res[i] < 0 then
      if n3 > 0 then rk := r3; n3 := n3 - 1; else rk := r2; n2 := n2 - 1; end if;
      select rk + 13 * sv into x from generate_series(0, 3) sv where not ((rk + 13 * sv) = any(used)) order by random() limit 1;
      res[i] := x; used := used || x;
    end if;
  end loop;
  return to_jsonb(res);
end $$;

-- réglages admin : forcer sa venue à ma prochaine partie d'un jeu, voir les réglages et mes compteurs
create or replace function public.mf_mys_admin(p_action text, p_game text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_action = 'force' then
    if not exists(select 1 from public.mf_mys_cfg where game = p_game) then raise exception 'mys_game'; end if;
    insert into public.mf_mys(uid, game, force) values (u, p_game, true)
      on conflict (uid, game) do update set force = true;
  end if;
  return jsonb_build_object(
    'cfg', (select jsonb_agg(to_jsonb(c) order by c.game) from public.mf_mys_cfg c),
    'me', (select coalesce(jsonb_agg(to_jsonb(m) - 'uid' order by m.game), '[]') from public.mf_mys m where m.uid = u));
end $$;

---------------------------------------------------------------------------------------------------
-- Banana Machine
create or replace function public.mf_slot_spin(p_force text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); s public.pstate; d date := (now() at time zone 'Europe/Paris')::date;
  n int; a text; b text; c text; r jsonb; t text; v int := 0; mys text;
begin
  perform public._tick(u);
  select * into s from public.pstate where uid = u for update;
  n := case when s.slot_day = d then s.slot_n else 0 end;
  if n >= 10 then raise exception 'slot_limit'; end if;
  if s.bananas < 1 then raise exception 'no_bananas'; end if;
  if p_force is not null and public.is_admin() and p_force in ('banane','rage','remboursement','camera','maman','sablier','booster','singe') then
    a := p_force; b := p_force; c := p_force;
  elsif public._mys_roll(u, 'slot') then
    a := 'maman'; b := 'maman'; c := 'maman';
    mys := 'Je donne un petit coup de pouce aux rouleaux… Triple « Planquez vos mamans » : +40 🍌 !';
  else
    a := public._slot_draw(); b := public._slot_draw(); c := public._slot_draw();
  end if;
  r := public._slot_pay(a, b, c);
  t := r->>'t'; v := coalesce((r->>'v')::int, 0);
  s.bananas := s.bananas - 1;
  if t = 'ban' then s.bananas := s.bananas + v; end if;
  if t = 'boost' then s.stock := least(99, s.stock + v); end if;
  update public.pstate set bananas = s.bananas, stock = s.stock, slot_day = d, slot_n = n + 1 where uid = u;
  if t = 'time' then
    if s.next_at is not null and s.stock < 3 then
      update public.pstate set next_at = next_at - make_interval(mins => v) where uid = u;
    else
      update public.pstate set slot_bank = least(1440, slot_bank + v) where uid = u;
    end if;
  end if;
  perform public._tick(u);
  perform public._mys_add(u, 'slot', public._mys_val(t, v) - 1);
  if r is not null and (t <> 'ban' or v >= 10) then
    perform public._feed(jsonb_build_object('kind', 'slot', 'uid', u, 'k', r->>'k', 'r', t, 'v', v));
  end if;
  return jsonb_build_object('s', jsonb_build_array(a, b, c), 'win', r, 'pity', false, 'mys', mys, 'left', 9 - n,
    'bank', (select slot_bank from public.pstate where uid = u), 'state', public._state(u));
end $$;

---------------------------------------------------------------------------------------------------
-- Monkey Cash (ticket à gratter) : l'annonce est rangée dans le ticket en attente (pending.mys)
create or replace function public.mf_scratch_buy(p_paid boolean default false, p_force text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_scratch_cfg; t public.mf_scratch; s public.pstate;
  d date := (now() at time zone 'Europe/Paris')::date; n int; w text; r jsonb; tt text; v int := 0; g text[]; mys text;
begin
  select * into c from public.mf_scratch_cfg where id = 1;
  if not coalesce(c.open, false) and not public.is_admin() then raise exception 'scratch_closed'; end if;
  insert into public.mf_scratch(uid) values (u) on conflict do nothing;
  select * into t from public.mf_scratch where uid = u for update;
  if t.pending is not null then return public._scratch_info(u); end if;
  perform public._tick(u);
  select * into s from public.pstate where uid = u for update;
  n := case when t.paid_day = d then t.paid_n else 0 end;
  if p_paid then
    if n >= c.paid_max then raise exception 'scratch_limit'; end if;
    if s.bananas < c.price then raise exception 'no_bananas'; end if;
  elsif t.free_day = d then
    raise exception 'scratch_free_used';
  end if;

  if p_force is not null and public.is_admin() and p_force in ('singe','booster','maman','sablier','camera','banane','perdu') then
    w := nullif(p_force, 'perdu');
  elsif public._mys_roll(u, 'scratch') then
    w := 'maman';
    mys := 'J''ai glissé un ticket spécial en haut de la pile… Gratte bien : trois « Planquez vos mamans », +25 🍌 !';
  else
    w := public._scratch_draw();
  end if;
  g := public._scratch_grid(w);
  r := public._scratch_prize(w);
  tt := r->>'t'; v := coalesce((r->>'v')::int, 0);

  if p_paid then s.bananas := s.bananas - c.price; end if;
  if tt = 'ban' then s.bananas := s.bananas + v; end if;
  if tt = 'boost' then s.stock := least(99, s.stock + v); end if;
  update public.pstate set bananas = s.bananas, stock = s.stock where uid = u;
  if tt = 'time' then
    if s.next_at is not null and s.stock < 3 then
      update public.pstate set next_at = next_at - make_interval(mins => v) where uid = u;
    else
      update public.pstate set slot_bank = least(1440, slot_bank + v) where uid = u;
    end if;
  end if;
  perform public._tick(u);
  perform public._mys_add(u, 'scratch', public._mys_val(tt, v) - case when p_paid then c.price else 0 end);

  update public.mf_scratch set
    free_day = case when p_paid then free_day else d end,
    paid_day = d, paid_n = n + case when p_paid then 1 else 0 end,
    total = total + 1,
    pending = jsonb_build_object('id', total + 1, 'grid', to_jsonb(g), 'win', r, 'paid', p_paid,
      'kept', tt = 'time' and (s.next_at is null or s.stock >= 3), 'mys', mys)
  where uid = u;
  return public._scratch_info(u);
end $$;

---------------------------------------------------------------------------------------------------
-- The Monkey Wheel
create or replace function public.mf_wheel_spin(p_kind text default 'paid', p_force text default null, p_scam boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_wheel_cfg; t public.mf_wheel; s public.pstate;
  d date := (now() at time zone 'Europe/Paris')::date; n int; w text; src text; idx int; k text; p jsonb; tt text; v int;
  sc boolean; adm boolean := public.is_admin(); fk text := case when public.is_admin() then nullif(p_force, '') end; mys text;
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
    perform public._mys_add(u, 'wheel', -c.price);
  end if;

  if fk is null and public._mys_roll(u, 'wheel') then
    fk := case when w = 'gold' then 'b25' else 'b10' end;
    mys := 'Je pose un doigt sur la roue… elle va s''arrêter sur ' || substr(fk, 2) || ' 🍌, et pas de Monkey Scam cette fois !';
  end if;
  idx := public._wheel_pick(w, fk);
  k := (public._wheel_seg(w))[idx + 1];
  p := public._wheel_prize(k); tt := p->>'t'; v := (p->>'v')::int;
  sc := mys is null and tt <> 'lose' and ((adm and coalesce(p_scam, false)) or random() < c.scam);
  if tt = 'jackpot' and not sc then v := c.pot; c.pot := c.pot0; end if;

  if sc then
    perform public._feed(jsonb_build_object('kind', 'wheel_scam', 'uid', u, 'lab', p->>'lab'));
    perform public._wheel_log(u, src || ' · Monkey Scam ! ' || (p->>'lab') || ' volé');
  elsif tt = 'lose' then
    perform public._wheel_log(u, src || ' · Perdu');
  else
    update public.mf_wheel set pending = jsonb_build_object('stage', 'choice', 't', tt, 'v', v, 'key', k) where uid = u;
    perform public._wheel_log(u, src || ' · ' || case when mys is not null then 'Singe Mystère 🔮 · ' else '' end || public._wheel_lab(tt, v));
  end if;
  update public.mf_wheel_cfg set pot = c.pot where id = 1;
  update public.mf_wheel set total = total + 1 where uid = u;
  return jsonb_build_object('wheel', w, 'idx', idx, 'key', k, 'gain', case when sc or tt = 'lose' then 0 else v end, 'scam', sc,
    'mys', mys, 'info', public._wheel_info(u));
end $$;

create or replace function public.mf_wheel_double(p_double boolean default false, p_force text default null, p_scam boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_wheel_cfg; t public.mf_wheel; tt text; v int; idx int; k text; won boolean; sc boolean := false;
  adm boolean := public.is_admin(); g jsonb;
begin
  select * into t from public.mf_wheel where uid = u for update;
  if t.pending is null or t.pending->>'stage' <> 'choice' then raise exception 'wheel_nothing'; end if;
  tt := coalesce(t.pending->>'t', 'ban'); v := coalesce((t.pending->>'v')::int, (t.pending->>'gain')::int);
  update public.mf_wheel set pending = null where uid = u;
  if not coalesce(p_double, false) then
    g := public._wheel_give(u, tt, v);
    perform public._mys_add(u, 'wheel', public._mys_val(tt, v));
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
    perform public._mys_add(u, 'wheel', public._mys_val(tt, 2 * v));
    perform public._wheel_feed(u, tt, 2 * v, true);
  end if;
  if sc then perform public._feed(jsonb_build_object('kind', 'wheel_scam', 'uid', u, 'lab', public._wheel_lab(tt, 2 * v))); end if;
  perform public._wheel_log(u, 'Quitte ou double · ' || case when sc then 'Monkey Scam ! ' || public._wheel_lab(tt, 2 * v) || ' volé' when won then 'doublé, ' || public._wheel_lab(tt, 2 * v) else 'perdu ' || public._wheel_lab(tt, v) end);
  return jsonb_build_object('wheel', 'qod', 'idx', idx, 'key', k, 't', tt, 'v', v, 'gain', case when won and not sc then 2 * v else 0 end, 'stake', v, 'scam', sc,
    'timeKept', coalesce(g->'kept', 'false'::jsonb), 'info', public._wheel_info(u));
end $$;

---------------------------------------------------------------------------------------------------
-- Le Champ de Cocos : game.m = nombre de cocos encore protégées
create or replace function public.mf_mine_start(p_bet integer, p_snakes integer, p_force text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_mine_cfg; t public.mf_mine; s public.pstate; d date := (now() at time zone 'Europe/Paris')::date;
  played int; adm boolean := public.is_admin(); f text := case when adm and p_force in ('boom', 'lucky') then p_force end; sn jsonb; mys text;
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
  if f is null and public._mys_roll(u, 'mine') then
    mys := 'Je surveille le champ pour toi : tes 5 prochaines cocos sont garanties sans serpent. Après, à toi de jouer !';
  end if;
  select jsonb_agg(x order by x) into sn from (select x from generate_series(0, 24) x order by random() limit p_snakes) z;
  update public.mf_mine set day = d, nb = played + 1,
    game = jsonb_build_object('bet', p_bet, 'n', p_snakes, 'snakes', sn, 'open', '[]'::jsonb, 'f', f, 'm', case when mys is not null then 5 else 0 end)
  where uid = u;
  return public._mine_info(u) || jsonb_build_object('mys', mys);
end $$;

create or replace function public.mf_mine_pick(p_cell integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); t public.mf_mine; g jsonb; sn int[]; op int[]; f text; n int; k int; alt int; boom boolean; mm int; ch boolean := false;
begin
  if p_cell is null or p_cell not between 0 and 24 then raise exception 'mine_cell'; end if;
  select * into t from public.mf_mine where uid = u for update;
  if t.game is null then raise exception 'mine_no_game'; end if;
  g := t.game; f := g->>'f'; n := (g->>'n')::int; mm := coalesce((g->>'m')::int, 0);
  select coalesce(array_agg(x::int), '{}') into sn from jsonb_array_elements_text(g->'snakes') x;
  select coalesce(array_agg(x::int), '{}') into op from jsonb_array_elements_text(g->'open') x;
  if p_cell = any(op) then raise exception 'mine_opened'; end if;
  if (mm > 0 or f = 'lucky') and p_cell = any(sn) then
    select x into alt from generate_series(0, 24) x where x <> p_cell and not (x = any(sn)) and not (x = any(op)) order by random() limit 1;
    if alt is not null then sn := array_replace(sn, p_cell, alt); end if;
    ch := true;
  elsif mm = 0 and f = 'boom' and not (p_cell = any(sn)) then
    sn[1 + floor(random() * n)::int] := p_cell;
    ch := true;
  end if;
  if ch then g := jsonb_set(g, '{snakes}', (select jsonb_agg(x order by x) from unnest(sn) x)); end if;
  if f = 'boom' and mm = 0 then g := g - 'f'; ch := true; end if;
  if mm > 0 then g := jsonb_set(g, '{m}', to_jsonb(mm - 1)); ch := true; end if;
  if ch then update public.mf_mine set game = g where uid = u; end if;
  boom := p_cell = any(sn);
  if boom then return public._mine_end(u, p_cell) || jsonb_build_object('cell', p_cell, 'safe', false); end if;

  g := jsonb_set(g, '{open}', (g->'open') || to_jsonb(p_cell));
  update public.mf_mine set game = g where uid = u;
  k := jsonb_array_length(g->'open');
  if k >= 25 - n or public._mine_mult(n, k) >= (select cap from public.mf_mine_cfg where id = 1) then
    return public._mine_end(u, null) || jsonb_build_object('cell', p_cell, 'safe', true, 'auto', true);
  end if;
  return jsonb_build_object('cell', p_cell, 'safe', true, 'out', null, 'prot', greatest(0, mm - 1), 'info', public._mine_info(u));
end $$;

create or replace function public._mine_end(p_uid uuid, p_boom integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.mf_mine; g jsonb; bet int; n int; k int; m numeric; pay int := 0; txt text; fm text;
begin
  select * into t from public.mf_mine where uid = p_uid for update;
  g := t.game; bet := (g->>'bet')::int; n := (g->>'n')::int; k := jsonb_array_length(g->'open');
  if p_boom is null then m := public._mine_mult(n, k); pay := floor(bet * m)::int;
  else m := public._mine_mult(n, k + 1); end if;
  if pay > 0 then update public.pstate set bananas = bananas + pay where uid = p_uid; end if;
  update public.mf_mine set game = null, total = total + 1 where uid = p_uid;
  perform public._mys_add(p_uid, 'mine', pay - bet);
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

---------------------------------------------------------------------------------------------------
-- The Monkey Tower : game.m = nombre d'étages encore protégés
create or replace function public.mf_tour_start(p_bet integer, p_force text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_tour_cfg; t public.mf_tour; s public.pstate; d date := (now() at time zone 'Europe/Paris')::date;
  played int; adm boolean := public.is_admin(); f text := case when adm and p_force in ('fall', 'top') then p_force end; mys text;
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
  if f is null and public._mys_roll(u, 'tour') then
    mys := 'Je connais ce temple par cœur : sur les 3 prochains étages, aucune porte n''est piégée pour toi. Ensuite, méfiance !';
  end if;
  update public.mf_tour set day = d, nb = played + 1,
    game = jsonb_build_object('bet', p_bet, 'fl', 0, 'f', f, 'm', case when mys is not null then 3 else 0 end) where uid = u;
  return public._tour_info(u) || jsonb_build_object('mys', mys);
end $$;

create or replace function public.mf_tour_pick(p_door integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_tour_cfg; t public.mf_tour; g jsonb; bet int; fl int; f text; trap int; n int; pay int := 0; lost int; mm int;
begin
  if p_door is null or p_door not between 0 and 2 then raise exception 'tour_door'; end if;
  select * into t from public.mf_tour where uid = u for update;
  if t.game is null then raise exception 'tour_no_game'; end if;
  select * into c from public.mf_tour_cfg where id = 1;
  g := t.game; bet := (g->>'bet')::int; fl := (g->>'fl')::int; f := g->>'f'; n := jsonb_array_length(c.mults);
  mm := coalesce((g->>'m')::int, 0);
  if fl >= n then raise exception 'tour_no_game'; end if;

  if mm > 0 then trap := (p_door + 1 + floor(random() * 2)::int) % 3; g := jsonb_set(g, '{m}', to_jsonb(mm - 1));
  elsif f = 'fall' then trap := p_door;
  elsif f = 'top' then trap := (p_door + 1 + floor(random() * 2)::int) % 3;
  else trap := floor(random() * 3)::int;
  end if;

  if trap = p_door then
    lost := public._tour_pay(bet, fl);
    update public.mf_tour set game = null, total = total + 1 where uid = u;
    if fl = 0 then
      update public.pstate set bananas = bananas + bet where uid = u;
      perform public._tour_log(u, 'Mise ' || bet || ' 🍌 · trappe au 1er étage · mise rendue');
    else
      perform public._tour_log(u, 'Mise ' || bet || ' 🍌 · trappe à l''étage ' || (fl + 1) || ' · −' || bet || ' 🍌');
      perform public._mys_add(u, 'tour', -bet);
    end if;
    if fl >= 5 then perform public._feed(jsonb_build_object('kind', 'tour_fall', 'uid', u, 'fl', fl + 1, 'v', lost)); end if;
    return jsonb_build_object('door', p_door, 'trap', trap, 'out', 'fall', 'fl', fl, 'bet', bet, 'pay', case when fl = 0 then bet else 0 end,
      'refund', fl = 0, 'lost', lost, 'info', public._tour_info(u));
  end if;

  fl := fl + 1;
  if fl >= n then
    pay := public._tour_end(u, bet, fl, true);
    return jsonb_build_object('door', p_door, 'trap', trap, 'out', 'top', 'fl', fl, 'bet', bet, 'pay', pay, 'net', pay - bet, 'info', public._tour_info(u));
  end if;
  update public.mf_tour set game = jsonb_set(g, '{fl}', to_jsonb(fl)) where uid = u;
  return jsonb_build_object('door', p_door, 'trap', trap, 'out', 'up', 'fl', fl, 'bet', bet, 'pay', public._tour_pay(bet, fl),
    'prot', greatest(0, mm - 1), 'info', public._tour_info(u));
end $$;

create or replace function public._tour_end(p_uid uuid, p_bet integer, p_fl integer, p_top boolean)
returns integer language plpgsql security definer set search_path = public as $$
declare pay int := public._tour_pay(p_bet, p_fl);
begin
  if pay > 0 then update public.pstate set bananas = bananas + pay where uid = p_uid; end if;
  update public.mf_tour set game = null, total = total + 1 where uid = p_uid;
  perform public._mys_add(p_uid, 'tour', pay - p_bet);
  perform public._tour_log(p_uid, 'Mise ' || p_bet || ' 🍌 · ' || case when p_top then 'SOMMET !' else 'redescendu de l''étage ' || p_fl end
    || ' · ' || case when pay - p_bet >= 0 then '+' else '' end || (pay - p_bet) || ' 🍌');
  if p_top or p_fl >= 6 then
    perform public._feed(jsonb_build_object('kind', 'tour', 'uid', p_uid, 'v', pay - p_bet, 'fl', p_fl, 'top', p_top));
  end if;
  return pay;
end $$;

---------------------------------------------------------------------------------------------------
-- Poker Monkey : le singe ne vient qu'au moment de l'échange, et seulement si la main fait moins qu'un full
create or replace function public.mf_vp_draw(p_hold integer[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_vp_cfg; t public.mf_vp; h jsonb; v_cards jsonb := '[]'::jsonb; v_deck jsonb;
  i int; q int := 0; bet int; k int; mult int; pay int; joker boolean; v_boost text; mys text; v_before jsonb;
begin
  select * into t from public.mf_vp where uid = u for update;
  if t.hand is null then raise exception 'vp_no_hand'; end if;
  select * into c from public.mf_vp_cfg where id = 1;
  h := t.hand; bet := (h->>'bet')::int; v_deck := h->'deck';
  for i in 0..4 loop
    if i = any(coalesce(p_hold, array[]::int[])) then
      v_cards := v_cards || (h->'c'->i);
    else
      v_cards := v_cards || (v_deck->q); q := q + 1;
    end if;
  end loop;
  k := public._vp_cat(v_cards);
  if k < 6 and public._mys_roll(u, 'vp') then
    v_before := v_cards;
    v_cards := public._mys_vp_full(h->'c', p_hold);
    k := public._vp_cat(v_cards);
    mys := 'Je change tes cartes en douce sous la table… Full ! ' || (c.pays->>6) || ' fois ta mise.';
  end if;
  mult := (c.pays->>k)::int;
  pay := bet * mult;
  v_boost := c.boosters->>k::text;
  if pay > 0 then update public.pstate set bananas = bananas + pay where uid = u; end if;
  if v_boost is not null then perform public._give_rpack(u, v_boost); end if;
  update public.mf_vp set hand = null, total = total + 1 where uid = u;
  perform public._mys_add(u, 'vp', pay - bet + case when v_boost is not null then 30 else 0 end);
  joker := v_cards @> '[52]'::jsonb;

  perform public._vp_log(u, 'Mise ' || bet || ' 🍌 · ' || public._vp_name(k) || case when joker then ' (Joker 🐒)' else '' end ||
    case when mys is not null then ' · Singe Mystère 🔮' else '' end ||
    case when v_boost is not null then ' · booster ' || v_boost || ' 🎁' when pay > bet then ' · +' || (pay - bet) || ' 🍌' else '' end);
  if k >= 7 then
    perform public._feed(jsonb_build_object('kind', 'vp', 'uid', u, 'r', k, 'v', pay - bet, 'j', joker, 'b', v_boost));
  end if;

  return jsonb_build_object('done', true, 'c', v_cards, 'cat', k, 'name', public._vp_name(k), 'bet', bet, 'mult', mult,
    'pay', pay, 'net', pay - bet, 'booster', v_boost, 'mys', mys, 'before', v_before, 'info', public._vp_info(u));
end $$;

---------------------------------------------------------------------------------------------------
-- Crash Cocotier : le cocotier tient au moins jusqu'à ×5 (départ retardé de 6,5 s pour laisser le temps de lire l'annonce)
create or replace function public.mf_coco_start(p_bet integer, p_force numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_coco_cfg; t public.mf_coco; s public.pstate;
  d date := (now() at time zone 'Europe/Paris')::date; v_n int; crash numeric; mys text;
begin
  select * into c from public.mf_coco_cfg where id = 1;
  if not public.mf_coco_open() and not public.is_admin() then raise exception 'coco_closed'; end if;
  insert into public.mf_coco(uid) values (u) on conflict do nothing;
  perform public._coco_settle(u);
  select * into t from public.mf_coco where uid = u for update;
  if t.round is not null then return public._coco_info(u); end if;
  if p_bet is null or p_bet < c.bet_min or p_bet > c.bet_max then raise exception 'coco_bad_amount'; end if;
  v_n := case when t.day = d then t.n else 0 end;
  if v_n >= c.daily then raise exception 'coco_limit'; end if;
  select * into s from public.pstate where uid = u for update;
  if s.bananas < p_bet then raise exception 'no_bananas'; end if;

  if p_force is not null and public.is_admin() then
    crash := least(c.cap, greatest(1, floor(p_force * 100) / 100));
  else
    crash := public._coco_draw(c.rtp, c.cap);
    if public._mys_roll(u, 'coco') then
      crash := least(c.cap, greatest(crash, 5.2));
      mys := 'J''ai solidement attaché ce cocotier : il tiendra au moins jusqu''à ×5. À toi de choisir quand encaisser !';
    end if;
  end if;
  update public.pstate set bananas = bananas - p_bet where uid = u;
  update public.mf_coco set day = d, n = v_n + 1, total = total + 1, last = null,
    round = jsonb_build_object('id', total + 1, 'bet', p_bet, 'crash', crash,
      'start', public._coco_now() + public._coco_lead() + case when mys is not null then 6500 else 0 end, 'mys', mys)
  where uid = u;
  return public._coco_info(u) || jsonb_build_object('mys', mys);
end $$;

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
  perform public._mys_add(p_uid, 'coco', gain - bet);
  update public.mf_coco set round = null,
    last = jsonb_build_object('id', r->'id', 'bet', bet, 'crash', crash, 'cash', p_cash, 'gain', gain, 'top', top, 'start', r->'start')
  where uid = p_uid;
  if top or (p_cash is not null and (p_cash >= 10 or (crash >= 10 and crash >= p_cash * 4))) then
    perform public._feed(jsonb_build_object('kind', 'coco', 'uid', p_uid, 'm', p_cash, 'c', crash, 'v', gain, 'b', bet, 'top', top));
  end if;
end $$;

---------------------------------------------------------------------------------------------------
-- Plinko Banana : la bille finit dans une case 20 🍌 (2e ou avant-dernière case)
create or replace function public.mf_pk_drop()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_pk_cfg; t public.mf_pk; s public.pstate; d date := (now() at time zone 'Europe/Paris')::date;
  played int; adm boolean := public.is_admin(); v_path int[]; v_slot int; i int; p jsonb; v_t text; v_v text; v_r text; n int;
  tgt int; mys text;
begin
  if not public.mf_pk_open() and not adm then raise exception 'pk_closed'; end if;
  insert into public.mf_pk(uid) values (u) on conflict do nothing;
  select * into t from public.mf_pk where uid = u for update;
  select * into c from public.mf_pk_cfg where id = 1;
  played := case when t.day = d then t.nb else 0 end;
  if played >= c.balls then raise exception 'pk_limit'; end if;
  select * into s from public.pstate where uid = u for update;
  if s.bananas < c.price then raise exception 'no_bananas'; end if;
  update public.pstate set bananas = bananas - c.price where uid = u;
  update public.mf_pk set day = d, nb = played + 1, total = total + 1, force = null where uid = u;

  if adm and t.force between 0 and c.rows_n then
    tgt := t.force;
  elsif public._mys_roll(u, 'pk') then
    tgt := case when random() < 0.5 then 1 else c.rows_n - 1 end;
    mys := 'Je souffle sur ta bille pour la guider… direction la case ' || coalesce((c.prizes->tgt->>'v'), '20') || ' 🍌 !';
  end if;
  if tgt is not null then
    select array_agg(x order by random()) into v_path
      from (select case when g <= tgt then 1 else 0 end x from generate_series(1, c.rows_n) g) z;
  else
    select array_agg(case when random() < 0.5 then 0 else 1 end) into v_path from generate_series(1, c.rows_n);
  end if;
  v_slot := 0; for i in 1..c.rows_n loop v_slot := v_slot + v_path[i]; end loop;

  p := c.prizes->v_slot; v_t := p->>'t'; v_v := p->>'v';
  if v_t = 'ban' then
    update public.pstate set bananas = bananas + v_v::int where uid = u;
  elsif v_t = 'boost' then
    update public.pstate set stock = least(99, stock + v_v::int), updated_at = now() where uid = u;
  elsif v_t = 'rpack' then
    perform public._give_rpack(u, v_v); v_r := v_v;
  elsif v_t = 'rwheel' then
    n := jsonb_array_length(p->'v');
    if adm and t.force_r is not null and exists(select 1 from jsonb_array_elements_text(p->'v') x where x = t.force_r) then
      v_r := t.force_r; update public.mf_pk set force_r = null where uid = u;
    else
      v_r := p->'v'->>(floor(random() * n))::int;
    end if;
    perform public._give_rpack(u, v_r);
  end if;
  perform public._mys_add(u, 'pk', public._mys_val(v_t, case when v_t in ('ban', 'boost') then v_v::int else 1 end) - c.price);

  perform public._pk_log(u, 'Case ' || (v_slot + 1) || ' · ' ||
    case when v_t = 'rwheel' then 'roulette → booster ' || v_r else public._pk_lab(p) end ||
    case when v_t = 'ban' and v_v::int > c.price then ' · +' || (v_v::int - c.price) || ' 🍌' else '' end ||
    case when mys is not null then ' · Singe Mystère 🔮' else '' end);
  if v_t in ('boost', 'rpack', 'rwheel') and not adm then
    perform public._feed(jsonb_build_object('kind', 'pk', 'uid', u, 'r', case when v_t = 'boost' then 'boost' else 'rpack' end,
      'v', case when v_t = 'boost' then v_v else v_r end, 'w', v_t = 'rwheel'));
  end if;

  return jsonb_build_object('path', to_jsonb(v_path), 'slot', v_slot, 'prize', p, 'rarity', v_r, 'price', c.price, 'mys', mys, 'info', public._pk_info(u));
end $$;

---------------------------------------------------------------------------------------------------
-- Bananateau : pas de triche, gain doublé si la banane est trouvée
create or replace function public.mf_bon_start(p_bet integer, p_speed text, p_force text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_bon_cfg; t public.mf_bon; s public.pstate; d date := (now() at time zone 'Europe/Paris')::date;
  played int; adm boolean := public.is_admin(); f text := case when adm then nullif(p_force, '') end;
  sp jsonb; pos int := 1; seq jsonb := '[]'::jsonb; a int; b int; i int; mys text;
begin
  if not public.mf_bon_open() and not adm then raise exception 'bon_closed'; end if;
  insert into public.mf_bon(uid) values (u) on conflict do nothing;
  select * into t from public.mf_bon where uid = u for update;
  if t.game is not null then raise exception 'bon_in_game'; end if;
  select * into c from public.mf_bon_cfg where id = 1;
  played := case when t.day = d then t.nb else 0 end;
  if played >= c.games then raise exception 'bon_limit'; end if;
  if p_bet is null or p_bet < c.min_bet or p_bet > c.max_bet then raise exception 'bon_bet'; end if;
  sp := c.speeds->p_speed;
  if p_speed is null or sp is null then raise exception 'bon_speed'; end if;
  select * into s from public.pstate where uid = u for update;
  if s.bananas < p_bet then raise exception 'no_bananas'; end if;
  update public.pstate set bananas = bananas - p_bet where uid = u;
  if f is null and public._mys_roll(u, 'bon') then
    mys := 'Je tiens le singe tricheur à l''œil : pas d''entourloupe cette partie, et ton gain est doublé si tu trouves la banane !';
  end if;
  for i in 1..greatest(1, (sp->>'n')::int) loop
    a := floor(random() * 3)::int; b := (a + 1 + floor(random() * 2)::int) % 3;
    seq := seq || jsonb_build_array(jsonb_build_array(least(a, b), greatest(a, b)));
    if pos = a then pos := b; elsif pos = b then pos := a; end if;
  end loop;
  update public.mf_bon set day = d, nb = played + 1,
    game = jsonb_build_object('bet', p_bet, 'speed', p_speed, 'pos', pos, 'f', f, 'mys', mys is not null) where uid = u;
  return jsonb_build_object('seq', seq, 'ms', (sp->>'ms')::int, 'mys', mys, 'info', public._bon_info(u));
end $$;

create or replace function public.mf_bon_pick(p_cup integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_bon_cfg; t public.mf_bon; g jsonb; bet int; pos int; f text; spd text; x numeric;
  res text; cheat boolean := false; pay int := 0; txt text; my boolean;
begin
  if p_cup is null or p_cup not between 0 and 2 then raise exception 'bon_cup'; end if;
  select * into t from public.mf_bon where uid = u for update;
  if t.game is null then raise exception 'bon_no_game'; end if;
  select * into c from public.mf_bon_cfg where id = 1;
  g := t.game; bet := (g->>'bet')::int; pos := (g->>'pos')::int; f := g->>'f'; my := coalesce((g->>'mys')::boolean, false);
  spd := coalesce(g->>'speed', 'fast'); x := coalesce((c.speeds->spd->>'x')::numeric, 2);
  if f in ('win', 'cheat') then pos := p_cup;
  elsif f = 'lose' and pos = p_cup then pos := (p_cup + 1 + floor(random() * 2)::int) % 3;
  end if;
  if pos = p_cup then
    if not my and (f = 'cheat' or (f is null and random() < c.cheat)) then res := 'cheat'; cheat := true;
    else res := 'win'; pay := ceil(x * bet)::int * case when my then 2 else 1 end; end if;
  else
    res := 'lose';
  end if;
  if pay > 0 then update public.pstate set bananas = bananas + pay where uid = u; end if;
  update public.mf_bon set game = null, total = total + 1 where uid = u;
  perform public._mys_add(u, 'bon', pay - bet);
  txt := 'Mise ' || bet || ' 🍌 · ' || case spd when 'slow' then 'lent' when 'turbo' then 'turbo' else 'rapide' end || ' · ' || case res when 'win' then 'trouvée ! +' || (pay - bet) || ' 🍌'
    when 'cheat' then 'trouvée… mais le singe avait escamoté la banane 🙈' else 'perdu' end || case when my then ' · Singe Mystère 🔮' else '' end;
  perform public._bon_log(u, txt);
  if res = 'win' and pay - bet >= 30 then
    perform public._feed(jsonb_build_object('kind', 'bon', 'uid', u, 'v', pay - bet, 'sp', spd));
  end if;
  if cheat then perform public._feed(jsonb_build_object('kind', 'bon_cheat', 'uid', u, 'v', bet)); end if;
  return jsonb_build_object('pick', p_cup, 'pos', case when cheat then null else pos end, 'out', res, 'bet', bet,
    'speed', spd, 'pay', pay, 'net', pay - bet, 'cheat', cheat, 'mys', my, 'info', public._bon_info(u));
end $$;

---------------------------------------------------------------------------------------------------
-- MonkeyJack 21 : Blackjack d'entrée
create or replace function public.mf_bj_deal(p_bet integer, p_force text default null, p_cheat boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_bj_cfg; t public.mf_bj; s public.pstate; d date := (now() at time zone 'Europe/Paris')::date;
  nn int; adm boolean := public.is_admin(); f text := case when adm then nullif(p_force, '') end; p jsonb; dl jsonb; h jsonb; ac int := floor(random() * 4)::int;
  mys text;
begin
  if not public.mf_bj_open() and not adm then raise exception 'bj_closed'; end if;
  insert into public.mf_bj(uid) values (u) on conflict do nothing;
  select * into t from public.mf_bj where uid = u for update;
  if t.hand is not null then raise exception 'bj_in_hand'; end if;
  select * into c from public.mf_bj_cfg where id = 1;
  nn := case when t.day = d then t.n else 0 end;
  if nn >= c.hands then raise exception 'bj_limit'; end if;
  if p_bet is null or p_bet < c.min_bet or p_bet > c.max_bet then raise exception 'bj_bet'; end if;
  select * into s from public.pstate where uid = u for update;
  if s.bananas < p_bet then raise exception 'no_bananas'; end if;
  update public.pstate set bananas = bananas - p_bet where uid = u;
  update public.mf_bj set day = d, n = nn + 1 where uid = u;

  p := jsonb_build_array(public._bj_card(), public._bj_card());
  dl := jsonb_build_array(public._bj_card(), public._bj_card());
  if f = 'monkey' then p := jsonb_build_array(13 * ac, 12 + 13 * ((ac + 1) % 4)); dl := jsonb_build_array(5, 20);
  elsif f = 'bj' then p := jsonb_build_array(13 * ac, 9 + 13 * ((ac + 2) % 4)); dl := jsonb_build_array(5, 20);
  elsif f = 'dealer' then dl := jsonb_build_array(13 * ac, 11 + 13 * ((ac + 1) % 4)); p := jsonb_build_array(6, 22);
  elsif f = 'bust' then p := jsonb_build_array(9, 23); dl := jsonb_build_array(5, 35);
  elsif f is null and not public._bj_is_bj(p) and public._mys_roll(u, 'bj') then
    p := jsonb_build_array(13 * ac, 9 + floor(random() * 3)::int + 13 * ((ac + 1 + floor(random() * 3)::int) % 4));
    if public._bj_is_bj(dl) then dl := jsonb_build_array(5, 20); end if;
    mys := 'Je te glisse un As et une figure sous la table… Blackjack ! Le singe croupier n''y a vu que du feu.';
  end if;
  h := jsonb_build_object('bet', p_bet, 'p', p, 'd', dl, 'dbl', false, 'fb', f = 'bust', 'fc', adm and coalesce(p_cheat, false), 'mys', mys);

  if public._bj_is_bj(p) or public._bj_is_bj(dl) then
    return public._bj_finish(u, h || '{"nat":true}'::jsonb);
  end if;
  update public.mf_bj set hand = h where uid = u;
  return jsonb_build_object('done', false, 'info', public._bj_info(u));
end $$;

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
      k := case when coalesce((h->>'fb')::boolean, false) then 9 + 13 * floor(random() * 4)::int else public._bj_card() end;
      h := h - 'fb';
      if public._bj_total(d || to_jsonb(k)) > 21 and (coalesce((h->>'fc')::boolean, false) or random() < c.cheat) then
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
  perform public._mys_add(p_uid, 'bj', pay - bet);

  txt := 'Mise ' || bet || ' 🍌 · ' || pt || ' contre ' || public._bj_total(d) || ' · ' ||
    case res when 'win' then 'gagné +' || (pay - bet) when 'push' then 'égalité' when 'bj' then 'Blackjack ! +' || (pay - bet)
      when 'monkey' then 'MONKEY BLACKJACK ! +' || (pay - bet) when 'bust' then 'sauté' when 'dealer_bj' then 'blackjack du singe' else 'perdu' end ||
    case when res in ('win', 'bj', 'monkey') then ' 🍌' else '' end || case when cheat then ' · le singe a triché 🃏' else '' end ||
    case when h->>'mys' is not null then ' · Singe Mystère 🔮' else '' end;
  perform public._bj_log(p_uid, txt);

  if res = 'monkey' or (pay - bet >= 30) then
    perform public._feed(jsonb_build_object('kind', 'bj', 'uid', p_uid, 'r', res, 'v', pay - bet, 'dbl', coalesce(h->'dbl', 'false'::jsonb)));
  end if;
  if cheat then perform public._feed(jsonb_build_object('kind', 'bj_cheat', 'uid', p_uid, 'v', bet)); end if;

  return jsonb_build_object('done', true, 'p', p, 'd', d, 'bet', bet, 'pt', pt, 'dt', public._bj_total(d), 'out', res,
    'pay', pay, 'net', pay - bet, 'cheat', cheat, 'ci', ci, 'dbl', coalesce(h->'dbl', 'false'::jsonb), 'mys', h->'mys', 'info', public._bj_info(p_uid));
end $$;

---------------------------------------------------------------------------------------------------
-- droits
revoke execute on function public._mys_val(text, int), public._mys_add(uuid, text, int), public._mys_roll(uuid, text),
  public._mys_vp_full(jsonb, int[]) from public, anon, authenticated;
revoke execute on function public.mf_mys_admin(text, text) from public, anon;
grant execute on function public.mf_mys_admin(text, text) to authenticated;
