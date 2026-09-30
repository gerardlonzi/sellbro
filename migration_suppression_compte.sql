-- ============================================================
-- SUPPRESSION DE COMPTE — à exécuter dans le SQL Editor Supabase
-- ============================================================
--
-- Permet à un utilisateur connecté d'effacer son profil, et avec lui TOUTES
-- ses données métier : chaque table (produits, ventes, clients, créances,
-- dépenses, fournisseurs, factures, mouvements, journal…) référence
-- profiles(id) avec ON DELETE CASCADE — la suppression est donc complète et
-- atomique.
--
-- NOTE : cette fonction ne supprime PAS l'identité de connexion (auth.users),
-- inaccessible depuis le SQL sans la clé service_role. L'identité n'est effacée
-- que si l'Edge Function `supprimer-compte` est déployée. Sans elle, l'utilisateur
-- peut toujours se reconnecter — il retrouve alors un compte vide, comme un
-- nouvel inscrit. C'est le comportement voulu : l'important est que ses données
-- disparaissent.

create or replace function public.supprimer_mon_compte()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() identifie l'appelant : impossible de viser un autre compte.
  delete from public.profiles where id = auth.uid();
end;
$$;

-- Réservée aux utilisateurs authentifiés (jamais à anon).
revoke execute on function public.supprimer_mon_compte() from anon;
grant execute on function public.supprimer_mon_compte() to authenticated;
