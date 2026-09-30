-- ============================================================
-- ESSAI GRATUIT — CORRECTIF « compte ancien = essai neuf »
-- À exécuter dans le SQL Editor Supabase, APRÈS schema.sql.
-- ============================================================
--
-- PROBLÈME CORRIGÉ
-- `demarrer_essai_user` créait la ligne d'essai à `now() + 3 jours` quand elle
-- n'en trouvait pas pour l'utilisateur. Or les lignes créées avant l'ajout de
-- la colonne `user_id` (schema.sql, section 25) ont `user_id = null` : elles
-- sont donc invisibles à la recherche par `user_id`. Résultat, un compte créé
-- il y a des mois obtenait un essai TOUT NEUF à sa première connexion, et
-- l'app affichait « 3 jours d'essai » indéfiniment.
--
-- CORRECTIF
-- L'essai est désormais ancré sur la DATE DE CRÉATION DU COMPTE
-- (`profiles.created_at`), jamais sur `now()`. Un compte ancien obtient donc
-- mécaniquement un essai déjà expiré — ce qui est la vérité.

-- ------------------------------------------------------------
-- 1) Rattacher les lignes orphelines qui désignent déjà un compte.
--    `demarrer_essai_user` écrivait `identifiant_appareil = p_user_id::text` :
--    certaines lignes portent donc l'uuid du compte sans le savoir.
-- ------------------------------------------------------------
update essais_gratuits e
set user_id = e.identifiant_appareil::uuid
where e.user_id is null
  and e.identifiant_appareil ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and exists (select 1 from profiles p where p.id = e.identifiant_appareil::uuid)
  -- La contrainte d'unicité sur user_id interdit deux lignes pour un compte.
  and not exists (select 1 from essais_gratuits x where x.user_id = e.identifiant_appareil::uuid);

-- ------------------------------------------------------------
-- 2) Créer une ligne pour chaque compte qui n'en a pas, calée sur
--    `profiles.created_at`. C'est ce qui fait basculer les vieux comptes
--    en « essai terminé » au lieu d'un essai neuf.
-- ------------------------------------------------------------
insert into essais_gratuits (user_id, identifiant_appareil, date_debut, date_fin)
select
  p.id,
  'compte:' || p.id::text,
  p.created_at,
  p.created_at + (
    coalesce((select valeur::integer from app_config where cle = 'duree_essai_jours'), 3)
    * interval '1 day'
  )
from profiles p
where not exists (select 1 from essais_gratuits e where e.user_id = p.id)
on conflict do nothing;

-- ------------------------------------------------------------
-- 3) Réécriture de la fonction : plus jamais d'essai neuf pour un compte ancien.
-- ------------------------------------------------------------
create or replace function demarrer_essai_user(p_user_id uuid)
returns table (date_debut timestamptz, date_fin timestamptz, jours_restants integer)
language plpgsql security definer set search_path = public as $$
declare
  duree integer;
  debut timestamptz;
  fin timestamptz;
begin
  -- Un utilisateur connecté ne peut interroger que son propre essai. (Sans
  -- cette garde, n'importe quel compte pouvait lire — et déclencher — l'essai
  -- d'un autre en passant son uuid.) On reste permissif quand il n'y a pas
  -- encore de session : l'app appelle cette fonction pendant l'onboarding.
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'Accès refusé';
  end if;

  select coalesce((select valeur::integer from app_config where cle = 'duree_essai_jours'), 3)
    into duree;

  select e.date_debut, e.date_fin into debut, fin
    from essais_gratuits e where e.user_id = p_user_id;

  if fin is null then
    -- Ancrage sur la création du COMPTE, jamais sur now().
    select p.created_at into debut from profiles p where p.id = p_user_id;
    debut := coalesce(debut, now());
    fin := debut + (duree * interval '1 day');

    insert into essais_gratuits (user_id, identifiant_appareil, date_debut, date_fin)
      values (p_user_id, 'compte:' || p_user_id::text, debut, fin)
      on conflict do nothing;

    -- Une insertion concurrente a pu gagner : on relit la ligne réellement
    -- en base plutôt que de renvoyer la nôtre.
    select e.date_debut, e.date_fin into debut, fin
      from essais_gratuits e where e.user_id = p_user_id;

    debut := coalesce(debut, now());
    fin := coalesce(fin, now());
  end if;

  return query select debut, fin,
    greatest(0, ceil(extract(epoch from (fin - now())) / 86400)::integer);
end;
$$;

-- ------------------------------------------------------------
-- 4) VÉRIFICATION — à lire après exécution.
--    Chaque compte doit avoir exactement une ligne, et les comptes créés il y
--    a plus de `duree_essai_jours` doivent tous ressortir avec 0 jour restant.
-- ------------------------------------------------------------
-- select p.email,
--        p.created_at::date as compte_cree_le,
--        e.date_fin::date      as essai_finit_le,
--        greatest(0, ceil(extract(epoch from (e.date_fin - now())) / 86400))::integer as jours_restants
--   from profiles p
--   left join essais_gratuits e on e.user_id = p.id
--   order by p.created_at;
