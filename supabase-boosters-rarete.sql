-- Monkey Family — boosters de rareté (Légendaire, Mythique, Secret, Originel)
-- Un booster de rareté contient 1 carte au hasard de sa rareté (cartes en jeu, hors exclusives).
-- Ils attendent dans pstate.rpacks (liste de raretés) et s'ouvrent en premier dans l'écran des boosters,
-- après les boosters exclusifs d'événement (mf_open_rpack). Premier jeu qui en donne : le Poker Monkey.

alter table public.pstate add column if not exists rpacks text[] not null default '{}';

-- l'état envoyé à l'appli : même chose qu'avant + 'rpacks'
create or replace function public._state(p_uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.pstate;
begin
  select * into s from public.pstate where uid = p_uid;
  return jsonb_build_object(
    'opened', s.opened, 'bananas', s.bananas, 'stock', s.stock, 'special', s.special,
    'nextAt', coalesce((extract(epoch from s.next_at) * 1000)::bigint, 0),
    'styles', to_jsonb(s.styles), 'style', s.style, 'counts', s.counts, 'pseudo', s.pseudo,
    'owned', coalesce((select jsonb_object_agg(card_key, n) from public.inv where uid = p_uid and n > 0), '{}'::jsonb),
    'now', (extract(epoch from now()) * 1000)::bigint,
    'packMs', (public._pack_hours() * 3600000)::bigint,
    'rewards', coalesce((select jsonb_agg(cat) from public.mf_rewards where uid = p_uid), '[]'::jsonb),
    'xpacks', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'skin', e.skin, 'n', cardinality(e.cards)) order by x.ord)
      from unnest(s.xpacks) with ordinality x(id, ord) join public.mf_events e on e.id = x.id), '[]'::jsonb),
    'rpacks', to_jsonb(coalesce(s.rpacks, '{}')),
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'kind', e.kind, 'hours', e.hours, 'boosters', e.boosters,
        'message', e.message, 'card', e.card_key, 'skin', e.skin, 'n', cardinality(e.cards), 'bananas', e.bananas, 'ends', (extract(epoch from e.ends_at) * 1000)::bigint) order by e.ends_at)
      from public.mf_events e where now() >= e.starts_at and now() < e.ends_at and (e.target is null or e.target = p_uid)), '[]'::jsonb));
end $$;

-- ajoute un booster de rareté à un joueur (appelé par les jeux, jamais depuis le site)
create or replace function public._give_rpack(p_uid uuid, p_rarity text)
returns void language sql security definer set search_path = public as $$
  update public.pstate set rpacks = coalesce(rpacks, '{}') || p_rarity, updated_at = now() where uid = p_uid $$;

-- ouvre le premier booster de rareté en attente : 1 carte au hasard de cette rareté
create or replace function public.mf_open_rpack()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); adm boolean := public.is_admin(); s public.pstate; v_r text; ck text; fresh text[] := '{}';
begin
  perform public._ensure(u);
  select * into s from public.pstate where uid = u for update;
  if cardinality(coalesce(s.rpacks, '{}')) = 0 then raise exception 'no_pack'; end if;
  v_r := s.rpacks[1];
  update public.pstate set rpacks = rpacks[2:], updated_at = now() where uid = u;
  select key into ck from public.cards where live and not excl and rarity = v_r order by random() limit 1;
  if ck is null then select key, rarity into ck, v_r from public.cards where live and not excl and rarity = 'Mythique' order by random() limit 1; end if;
  if ck is null then raise exception 'no_cards'; end if;
  if not exists (select 1 from public.inv where uid = u and card_key = ck and n > 0) then fresh := array[ck]; end if;
  insert into public.inv(uid, card_key, n) values (u, ck, 1) on conflict (uid, card_key) do update set n = public.inv.n + 1;
  update public.pstate set counts = jsonb_set(coalesce(counts, '{}'::jsonb), array[v_r], to_jsonb(coalesce((counts->>v_r)::int, 0) + 1)) where uid = u;
  if public._tier(v_r) >= 2 and not adm then perform public._feed(jsonb_build_object('kind', 'pull', 'uid', u::text, 'rarity', v_r)); end if;
  perform public._publish(u);
  return jsonb_build_object('cards', jsonb_build_array(ck), 'fresh', to_jsonb(fresh), 'rpack', jsonb_build_object('rarity', v_r), 'state', public._state(u));
end $$;

revoke execute on function public._give_rpack(uuid, text) from public, anon, authenticated;
revoke execute on function public.mf_open_rpack() from public, anon;
grant execute on function public.mf_open_rpack() to authenticated;

-- Poker Monkey : quinte flush et mieux donnent un booster de rareté (+ la mise rendue)
alter table public.mf_vp_cfg add column if not exists boosters jsonb not null
  default '{"8":"Légendaire","9":"Mythique","10":"Secret","11":"Originel"}'::jsonb;
update public.mf_vp_cfg set pays = '[0,1,1,2,3,5,7,20,1,1,1,1]'::jsonb where id = 1;

-- 26/11 vers 13 h 15 (demande de Kévin) : table adoucie (quinte ×4, couleur ×6, full ×8 → ~94 % rendu),
-- poker ouvert et ajouté à la rotation ; ordre du pool choisi pour garder lundi 30/11 = Bananateau + MonkeyJack 21
-- (calendrier : 30/11 bon+bj · 07/12 race+vp · 14/12 coco+bon · 21/12 bj+race · 28/12 vp+coco)
update public.mf_vp_cfg set pays = '[0,1,1,2,4,6,8,20,1,1,1,1]'::jsonb, open = true where id = 1;
update public.mf_casino_cfg set pool = array['bj','race','vp','coco','bon'] where id = 1;

create or replace function public._vp_info(p_uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.mf_vp_cfg; t public.mf_vp; d date := (now() at time zone 'Europe/Paris')::date; h jsonb;
begin
  select * into c from public.mf_vp_cfg where id = 1;
  select * into t from public.mf_vp where uid = p_uid;
  if t.hand is not null then
    h := jsonb_build_object('bet', t.hand->'bet', 'c', t.hand->'c', 'cat', public._vp_cat(t.hand->'c'));
  end if;
  return jsonb_build_object(
    'open', coalesce(c.open, false), 'min', c.min_bet, 'maxBet', c.max_bet, 'max', c.hands, 'pays', c.pays, 'boosters', c.boosters,
    'left', greatest(0, c.hands - case when t.day = d then t.nb else 0 end),
    'hand', h,
    'hist', coalesce(t.hist, '[]'::jsonb),
    'nextDay', (extract(epoch from ((d + 1)::timestamp at time zone 'Europe/Paris')) * 1000)::bigint,
    'now', (extract(epoch from now()) * 1000)::bigint,
    'state', public._state(p_uid));
end $$;

create or replace function public.mf_vp_draw(p_hold int[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public._check(); c public.mf_vp_cfg; t public.mf_vp; h jsonb; v_cards jsonb := '[]'::jsonb; v_deck jsonb;
  i int; q int := 0; bet int; k int; mult int; pay int; joker boolean; v_boost text;
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
  mult := (c.pays->>k)::int;
  pay := bet * mult;
  v_boost := c.boosters->>k::text;
  if pay > 0 then update public.pstate set bananas = bananas + pay where uid = u; end if;
  if v_boost is not null then perform public._give_rpack(u, v_boost); end if;
  update public.mf_vp set hand = null, total = total + 1 where uid = u;
  joker := v_cards @> '[52]'::jsonb;

  perform public._vp_log(u, 'Mise ' || bet || ' 🍌 · ' || public._vp_name(k) || case when joker then ' (Joker 🐒)' else '' end ||
    case when v_boost is not null then ' · booster ' || v_boost || ' 🎁' when pay > bet then ' · +' || (pay - bet) || ' 🍌' else '' end);
  if k >= 7 then
    perform public._feed(jsonb_build_object('kind', 'vp', 'uid', u, 'r', k, 'v', pay - bet, 'j', joker, 'b', v_boost));
  end if;

  return jsonb_build_object('done', true, 'c', v_cards, 'cat', k, 'name', public._vp_name(k), 'bet', bet, 'mult', mult,
    'pay', pay, 'net', pay - bet, 'booster', v_boost, 'info', public._vp_info(u));
end $$;
