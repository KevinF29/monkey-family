-- Monkey Family — Ticket à gratter (« Monkey Cash »)
-- À lancer une seule fois dans Supabase (SQL Editor). Ne touche à aucune table existante :
-- crée deux tables (mf_scratch, mf_scratch_cfg) et les fonctions mf_scratch_*.
-- Le ticket reste visible par l'admin seulement tant que mf_scratch_cfg.open = false
-- (bouton « Ouvrir à tous » dans les réglages admin du ticket).
--
-- Règles :
--  - 1 ticket gratuit par jour (heure de Paris, non cumulable)
--  - tickets payants : prix et maximum par jour réglables dans mf_scratch_cfg (5 🍌, 5 par jour au départ)
--  - 9 cases ; 3 symboles identiques = le gain de ce symbole (un seul gain possible par ticket)
--  - le gain est donné dès l'achat (rien n'est perdu si l'appli se ferme) ; le ticket reste
--    « à gratter » jusqu'à ce que le joueur l'ait gratté (mf_scratch_done), et c'est là qu'il part dans le fil d'actu

create table if not exists public.mf_scratch (
  uid uuid primary key,
  free_day date,               -- dernier jour où le ticket gratuit a été pris
  paid_day date,               -- jour du compteur paid_n
  paid_n int not null default 0,
  pending jsonb,               -- ticket acheté, pas encore gratté
  total int not null default 0
);
alter table public.mf_scratch enable row level security;   -- aucune politique : on passe uniquement par les fonctions

create table if not exists public.mf_scratch_cfg (
  id int primary key default 1 check (id = 1),
  open boolean not null default false,
  price int not null default 5,
  paid_max int not null default 5
);
alter table public.mf_scratch_cfg enable row level security;
insert into public.mf_scratch_cfg(id) values (1) on conflict do nothing;

-- gains : symbole -> type (ban = bananes, boost = boosters, time = minutes d'attente en moins) et valeur
create or replace function public._scratch_prize(sym text)
returns jsonb language sql immutable set search_path = public as $$
  select case sym
    when 'singe'   then '{"k":"singe","t":"boost","v":5}'
    when 'booster' then '{"k":"booster","t":"boost","v":1}'
    when 'maman'   then '{"k":"maman","t":"ban","v":25}'
    when 'sablier' then '{"k":"sablier","t":"time","v":120}'
    when 'camera'  then '{"k":"camera","t":"ban","v":10}'
    when 'banane'  then '{"k":"banane","t":"ban","v":5}'
  end::jsonb $$;

-- tirage du résultat (sur 1000) : 0,4 % jackpot, 2,5 % booster, 3 % 25 🍌, 4 % −2 h, 7 % 10 🍌, 15 % 5 🍌, 68,1 % perdu
create or replace function public._scratch_draw()
returns text language plpgsql set search_path = public as $$
declare r int := floor(random() * 1000)::int;
begin
  if r < 4   then return 'singe';   end if; r := r - 4;
  if r < 25  then return 'booster'; end if; r := r - 25;
  if r < 30  then return 'maman';   end if; r := r - 30;
  if r < 40  then return 'sablier'; end if; r := r - 40;
  if r < 70  then return 'camera';  end if; r := r - 70;
  if r < 150 then return 'banane';  end if;
  return null;  -- perdu
end $$;

-- les 9 cases : 3 fois le symbole gagnant (s'il y en a un), les autres symboles au plus 2 fois chacun
create or replace function public._scratch_grid(win text)
returns text[] language plpgsql set search_path = public as $$
declare syms text[] := array['singe','booster','maman','sablier','camera','banane']; pool text[]; g text[];
begin
  select array_agg(s order by random()) into pool
    from unnest(syms) s cross join generate_series(1, 2) where s is distinct from win;
  if win is null then
    g := pool[1:9];
  else
    g := pool[1:6] || array[win, win, win];
  end if;
  select array_agg(x order by random()) into g from unnest(g) x;
  return g;
end $$;

create or replace function public._scratch_info(p_uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.mf_scratch_cfg; t public.mf_scratch; d date := (now() at time zone 'Europe/Paris')::date;
begin
  select * into c from public.mf_scratch_cfg where id = 1;
  select * into t from public.mf_scratch where uid = p_uid;
  return jsonb_build_object(
    'open', coalesce(c.open, false), 'price', coalesce(c.price, 5), 'max', coalesce(c.paid_max, 5),
    'free', t.free_day is distinct from d,
    'paidLeft', greatest(0, coalesce(c.paid_max, 5) - case when t.paid_day = d then t.paid_n else 0 end),
    'pending', t.pending,
    'nextFree', (extract(epoch from ((d + 1)::timestamp at time zone 'Europe/Paris')) * 1000)::bigint,
    'state', public._state(p_uid));
end $$;

-- le bouton est-il visible pour tous ?
create or replace function public.mf_scratch_open()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select open from public.mf_scratch_cfg where id = 1), false) $$;

create or replace function public.mf_scratch_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  perform public._tick(u);
  return public._scratch_info(u);
end $$;

-- prendre un ticket : p_paid = false pour le gratuit du jour, true pour un ticket payant
-- p_force (admin seulement) : 'singe', 'booster', 'maman', 'sablier', 'camera', 'banane' ou 'perdu'
create or replace function public.mf_scratch_buy(p_paid boolean default false, p_force text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_scratch_cfg; t public.mf_scratch; s public.pstate;
  d date := (now() at time zone 'Europe/Paris')::date; n int; w text; r jsonb; tt text; v int := 0; g text[];
begin
  select * into c from public.mf_scratch_cfg where id = 1;
  if not coalesce(c.open, false) and not public.is_admin() then raise exception 'scratch_closed'; end if;
  insert into public.mf_scratch(uid) values (u) on conflict do nothing;
  select * into t from public.mf_scratch where uid = u for update;
  -- un ticket pas encore gratté : on le redonne au lieu d'en prendre un autre
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
  else
    w := public._scratch_draw();
  end if;
  g := public._scratch_grid(w);
  r := public._scratch_prize(w);
  tt := r->>'t'; v := coalesce((r->>'v')::int, 0);

  -- mise et gain (donnés tout de suite)
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

  update public.mf_scratch set
    free_day = case when p_paid then free_day else d end,
    paid_day = d, paid_n = n + case when p_paid then 1 else 0 end,
    total = total + 1,
    pending = jsonb_build_object('id', total + 1, 'grid', to_jsonb(g), 'win', r, 'paid', p_paid,
      'kept', tt = 'time' and (s.next_at is null or s.stock >= 3))
  where uid = u;
  return public._scratch_info(u);
end $$;

-- le joueur a fini de gratter : le ticket disparaît, et les beaux gains partent dans le fil d'actu
create or replace function public.mf_scratch_done()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); t public.mf_scratch; r jsonb;
begin
  select * into t from public.mf_scratch where uid = u for update;
  if t.pending is not null then
    r := t.pending->'win';
    if r is not null and jsonb_typeof(r) = 'object' and (r->>'t' <> 'ban' or (r->>'v')::int >= 25) then
      perform public._feed(jsonb_build_object('kind', 'scratch', 'uid', u, 'k', r->>'k', 'r', r->>'t', 'v', (r->>'v')::int));
    end if;
    update public.mf_scratch set pending = null where uid = u;
  end if;
  return public._scratch_info(u);
end $$;

-- admin : 'reset' (rend le ticket gratuit et les tickets payants du jour), 'open' / 'close' (visible par tous ou non)
create or replace function public.mf_scratch_admin(p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check();
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_action = 'reset' then
    update public.mf_scratch set free_day = null, paid_n = 0, pending = null where uid = u;
  elsif p_action = 'open' then
    update public.mf_scratch_cfg set open = true where id = 1;
  elsif p_action = 'close' then
    update public.mf_scratch_cfg set open = false where id = 1;
  end if;
  return public._scratch_info(u);
end $$;

-- les fonctions internes ne s'appellent pas depuis le site
revoke execute on function public._scratch_prize(text), public._scratch_draw(), public._scratch_grid(text), public._scratch_info(uuid) from public, anon, authenticated;
