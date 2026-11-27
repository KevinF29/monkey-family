-- =====================================================================
-- Monkey Family — v16 : « Qui possède quoi » dans le classeur (admin seulement)
-- Ajoute une seule fonction, en lecture seule. Ne modifie aucune donnée.
-- Seul un compte admin peut l'appeler : les autres reçoivent l'erreur not_admin.
-- Renvoie les joueurs actifs (hors comptes admin) avec leurs cartes : { carte: nombre }.
-- =====================================================================
create or replace function public.mf_admin_owners()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'uid', m.uid,
             'pseudo', coalesce(nullif(p.pseudo, ''), m.pseudo),
             'owned', coalesce((select jsonb_object_agg(i.card_key, i.n) from public.inv i where i.uid = m.uid and i.n > 0), '{}'::jsonb))
           order by lower(coalesce(nullif(p.pseudo, ''), m.pseudo)))
    from public.members m
    left join public.pstate p on p.uid = m.uid
    where m.active and not exists (select 1 from public.admins a where a.uid = m.uid)), '[]'::jsonb);
end $$;

revoke execute on function public.mf_admin_owners() from public, anon;
grant execute on function public.mf_admin_owners() to authenticated;
