-- =====================================================================
-- Monkey Family — v17 : l'admin peut offrir des bananes
--  • nouveau type d'événement « 🍌 Bananes offertes » (à tout le monde ou à un seul pote, à une date choisie)
--  • des bananes « en plus » possibles sur les autres cadeaux (boosters, booster spécial, booster exclusif, carte)
-- Ajoute une colonne et met à jour 4 fonctions existantes (même code + les bananes). Ne modifie aucune donnée.
-- =====================================================================

alter table public.mf_events add column if not exists bananas int not null default 0;
alter table public.mf_events drop constraint if exists mf_events_kind_check;
alter table public.mf_events add constraint mf_events_kind_check check (kind in ('gift', 'special', 'speed', 'card', 'xpack', 'bananas'));

-- Enregistrer un événement (admin)
create or replace function public.mf_event_save(p jsonb)
returns bigint language plpgsql security definer set search_path to 'public' as $function$
declare i bigint := nullif(p->>'id', '')::bigint; t text := trim(coalesce(p->>'title', '')); k text := p->>'kind';
  st timestamptz := to_timestamp((p->>'starts')::numeric / 1000); en timestamptz := to_timestamp((p->>'ends')::numeric / 1000);
  b int := greatest(0, least(20, coalesce((p->>'boosters')::int, 0))); h numeric := greatest(1, least(8, coalesce((p->>'hours')::numeric, 8)));
  msg text := left(coalesce(p->>'message', ''), 200); ck text := nullif(p->>'card', '');
  cs text[] := coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p->'cards', '[]'::jsonb)) x), '{}');
  sk text := coalesce(nullif(p->>'skin', ''), 'noel');
  tg uuid := nullif(p->>'target', '')::uuid;
  bn int := greatest(0, least(100000, coalesce((p->>'bananas')::int, 0)));
begin
  perform public._check();
  if not public.is_admin() then raise exception 'admin only'; end if;
  if t = '' then raise exception 'title'; end if;
  if k not in ('gift', 'special', 'speed', 'card', 'xpack', 'bananas') then raise exception 'kind'; end if;
  if k = 'card' and ck is null then raise exception 'card'; end if;
  if k = 'speed' then ck := null; bn := 0; end if;
  if ck is not null and not exists (select 1 from public.cards where key = ck and excl) then raise exception 'card'; end if;
  if k = 'xpack' then
    ck := null;
    if cardinality(cs) < 1 or cardinality(cs) > 9 or (select count(distinct x) from unnest(cs) x) <> cardinality(cs) then raise exception 'cards'; end if;
    if exists (select 1 from unnest(cs) x where not exists (select 1 from public.cards c where c.key = x and c.excl)) then raise exception 'cards'; end if;
    if sk not in ('noel', 'gaming') then raise exception 'skin'; end if;
    b := greatest(1, least(5, b));
  else cs := '{}'; end if;
  if en <= st then raise exception 'dates'; end if;
  if k = 'speed' then tg := null; end if;  -- l'attente réduite vaut pour tout le monde
  if tg is not null and not exists (select 1 from public.members where uid = tg) and not exists (select 1 from public.admins where uid = tg) then raise exception 'target'; end if;
  if k in ('gift', 'special') and b < 1 then raise exception 'boosters'; end if;
  if k = 'card' then b := 0; end if;
  if k = 'bananas' then
    b := 0;
    if bn < 1 then raise exception 'bananas'; end if;
    if msg = '' then msg := bn || ' banane' || case when bn > 1 then 's' else '' end || ' t''attend' || case when bn > 1 then 'ent' else '' end || ' !'; end if;
  end if;
  if i is null then
    insert into public.mf_events(title, kind, starts_at, ends_at, boosters, hours, message, card_key, cards, skin, fixed, target, bananas)
    values (left(t, 60), k, st, en, b, h, msg, ck, cs, sk, k <> 'speed', tg, bn) returning id into i;
  else
    update public.mf_events set title = left(t, 60), kind = k, starts_at = st, ends_at = en, boosters = b, hours = h, message = msg, card_key = ck, cards = cs, skin = sk,
      fixed = (k <> 'speed'), target = tg, bananas = bn where id = i;
  end if;
  return i;
end $function$;

-- Liste des événements (admin)
create or replace function public.mf_events_admin()
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
begin
  perform public._check();
  if not public.is_admin() then raise exception 'admin only'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'kind', e.kind, 'boosters', e.boosters, 'hours', e.hours, 'message', e.message, 'card', e.card_key,
      'cards', to_jsonb(e.cards), 'skin', e.skin, 'target', e.target, 'fixed', e.fixed, 'bananas', e.bananas,
      'starts', (extract(epoch from e.starts_at) * 1000)::bigint, 'ends', (extract(epoch from e.ends_at) * 1000)::bigint,
      'claims', (select count(*) from public.mf_event_claims c where c.event_id = e.id)) order by e.starts_at desc) from public.mf_events e), '[]'::jsonb);
end $function$;

-- Distribution des cadeaux (à chaque visite du joueur)
create or replace function public._grant(p_uid uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare out jsonb := '[]'::jsonb; e record; c record; ex text[];
begin
  -- un cadeau est distribué à partir de son heure, et reste à récupérer ensuite (même pour un joueur qui revient plus tard)
  for e in select * from public.mf_events where (kind in ('gift', 'special', 'xpack') and boosters > 0 or card_key is not null or bananas > 0) and kind <> 'speed' and now() >= starts_at and (fixed or now() < ends_at)
      and (target is null or target = p_uid)
      and not exists (select 1 from public.mf_event_claims k where k.uid = p_uid and k.event_id = mf_events.id) loop
    insert into public.mf_event_claims(uid, event_id) values (p_uid, e.id) on conflict do nothing;
    if e.kind = 'special' then update public.pstate set special = special + e.boosters where uid = p_uid;
    elsif e.kind = 'gift' then update public.pstate set stock = least(99, stock + e.boosters) where uid = p_uid;
    elsif e.kind = 'xpack' then update public.pstate set xpacks = xpacks || array_fill(e.id, array[e.boosters]) where uid = p_uid; end if;
    if e.bananas > 0 then update public.pstate set bananas = bananas + e.bananas where uid = p_uid; end if;
    if e.card_key is not null and exists (select 1 from public.cards where key = e.card_key) then
      insert into public.inv(uid, card_key, n) values (p_uid, e.card_key, 1) on conflict (uid, card_key) do update set n = public.inv.n + 1;
    end if;
    out := out || jsonb_build_object('kind', 'event', 'title', e.title, 'message', e.message, 'boosters', case when e.kind in ('card', 'xpack', 'bananas') then 0 else e.boosters end,
      'special', e.kind = 'special', 'xpack', case when e.kind = 'xpack' then e.boosters else 0 end, 'skin', e.skin, 'n', cardinality(e.cards),
      'bananas', e.bananas,
      'cards', case when e.card_key is null then '[]'::jsonb else jsonb_build_array(e.card_key) end);
  end loop;
  -- une catégorie est complète quand le joueur a toutes ses cartes de booster ; elle doit avoir au moins une carte exclusive
  for c in select cat, array_agg(key) filter (where excl) as excl_keys from public.cards where live group by cat
      having count(*) filter (where excl) > 0 and count(*) filter (where not excl) > 0 loop
    if exists (select 1 from public.mf_rewards r where r.uid = p_uid and r.cat = c.cat) then continue; end if;
    if exists (select 1 from public.cards k where k.live and not k.excl and k.cat = c.cat
        and not exists (select 1 from public.inv i where i.uid = p_uid and i.card_key = k.key and i.n > 0)) then continue; end if;
    insert into public.mf_rewards(uid, cat) values (p_uid, c.cat) on conflict do nothing;
    ex := c.excl_keys;
    insert into public.inv(uid, card_key, n) select p_uid, k, 1 from unnest(ex) k on conflict (uid, card_key) do update set n = public.inv.n + 1;
    update public.pstate set stock = least(99, stock + 3) where uid = p_uid;
    out := out || jsonb_build_object('kind', 'collection', 'cat', c.cat, 'cards', to_jsonb(ex), 'boosters', 3);
    perform public._feed(jsonb_build_object('kind', 'complete', 'uid', p_uid::text, 'cat', c.cat));
  end loop;
  -- la carte ultime : quand le joueur a toutes les cartes de booster du jeu
  if not exists (select 1 from public.mf_rewards r where r.uid = p_uid and r.cat = 'Collection complète')
      and exists (select 1 from public.cards where live and excl and cat = 'Collection complète')
      and exists (select 1 from public.cards where live and not excl)
      and not exists (select 1 from public.cards k where k.live and not k.excl
        and not exists (select 1 from public.inv i where i.uid = p_uid and i.card_key = k.key and i.n > 0)) then
    insert into public.mf_rewards(uid, cat) values (p_uid, 'Collection complète') on conflict do nothing;
    ex := array(select key from public.cards where live and excl and cat = 'Collection complète' order by name);
    insert into public.inv(uid, card_key, n) select p_uid, k, 1 from unnest(ex) k on conflict (uid, card_key) do update set n = public.inv.n + 1;
    out := out || jsonb_build_object('kind', 'collection', 'cat', 'Collection complète', 'cards', to_jsonb(ex), 'boosters', 0, 'ultimate', true);
    perform public._feed(jsonb_build_object('kind', 'complete', 'uid', p_uid::text, 'cat', 'Collection complète'));
  end if;
  if jsonb_array_length(out) > 0 then perform public._publish(p_uid); end if;
  return out;
end $function$;

-- État du joueur : le bandeau des événements connaît aussi les bananes
create or replace function public._state(p_uid uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
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
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'kind', e.kind, 'hours', e.hours, 'boosters', e.boosters,
        'message', e.message, 'card', e.card_key, 'skin', e.skin, 'n', cardinality(e.cards), 'bananas', e.bananas, 'ends', (extract(epoch from e.ends_at) * 1000)::bigint) order by e.ends_at)
      from public.mf_events e where now() >= e.starts_at and now() < e.ends_at and (e.target is null or e.target = p_uid)), '[]'::jsonb));
end $function$;
