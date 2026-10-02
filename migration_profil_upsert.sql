-- ============================================================
-- CORRECTIF — sauvegarde du profil fiable (compte absent de la base)
-- À exécuter dans le SQL Editor Supabase.
-- ============================================================
--
-- PROBLÈME : `sauvegarder_profil_inscription` faisait un UPDATE par email.
-- Appelée AVANT la vérification OTP (sans session), si la ligne `profiles`
-- n'existait pas encore, l'UPDATE ne matchait rien, silencieusement — le
-- compte restait absent de la base (ou vide). Cette version INSÈRE la ligne
-- si besoin (UPSERT sur l'id du user auth).
--
-- NOTE : côté app, `verifierCodeEmail` réécrit aussi le profil APRÈS la
-- vérification (quand la session existe) — double sécurité. Cette fonction
-- reste utile pour écrire le profil dès l'inscription.

create or replace function public.sauvegarder_profil_inscription(
  p_email text,
  p_nom_boutique text,
  p_telephone text,
  p_langue text,
  p_devise text,
  p_pays_code text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nom_boutique, telephone, langue, devise, pays_code)
  select u.id, p_email, p_nom_boutique, p_telephone, p_langue, p_devise, p_pays_code
    from auth.users u where u.email = p_email
  on conflict (id) do update
    set nom_boutique = excluded.nom_boutique,
        telephone = excluded.telephone,
        langue = excluded.langue,
        devise = excluded.devise,
        pays_code = excluded.pays_code;
end;
$$;

grant execute on function public.sauvegarder_profil_inscription(text, text, text, text, text, text) to anon, authenticated;

-- VÉRIFICATION : tout user auth doit avoir une ligne profiles.
-- select u.id, u.email, p.id as profil_id
--   from auth.users u left join public.profiles p on p.id = u.id
--   order by u.created_at desc;
