-- ============================================================
-- REFONTE ESSAI GRATUIT — à exécuter dans le SQL Editor Supabase
-- Modèle 2 formules : essai gratuit (durée configurable) + Premium
-- ============================================================

-- 1) Durée d'essai configurable en base (3 jours par défaut).
--    Change-la ici (ou via l'UI app_config) pour passer à 7, 14 jours…
--    sans toucher au code de l'app.
insert into app_config (cle, valeur, type) values
  ('duree_essai_jours', '3', 'number')
on conflict (cle) do update set valeur = excluded.valeur;

-- 2) DÉMARRER l'essai : la date de fin est calculée CÔTÉ SERVEUR
--    (jamais à partir de la date du téléphone).
create or replace function demarrer_essai(identifiant text)
returns table (date_debut timestamptz, date_fin timestamptz, jours_restants integer)
language plpgsql security definer as $$
declare
  duree integer;
  debut timestamptz;
  fin timestamptz;
begin
  select coalesce((select valeur::integer from app_config where cle = 'duree_essai_jours'), 3)
    into duree;

  select date_debut, date_fin into debut, fin
    from essais_gratuits where identifiant_appareil = identifiant;

  if fin is not null then
    return query select debut, fin,
      greatest(0, ceil(extract(epoch from (fin - now())) / 86400)::integer);
    return;
  end if;

  debut := now();
  fin := debut + (duree * interval '1 day');

  insert into essais_gratuits (identifiant_appareil, date_debut, date_fin)
    values (identifiant, debut, fin)
    on conflict (identifiant_appareil) do nothing;

  return query select debut, fin,
    greatest(0, ceil(extract(epoch from (fin - now())) / 86400)::integer);
end;
$$;

-- 3) VÉRIFIER l'essai : autorité serveur. Utilise now() serveur,
--    donc insensible à la date du téléphone.
create or replace function verifier_essai(identifiant text)
returns table (actif boolean, jours_restants integer, date_fin timestamptz)
language plpgsql security definer as $$
declare
  fin timestamptz;
begin
  select date_fin into fin from essais_gratuits
    where identifiant_appareil = identifiant;

  if fin is null then
    return query select false, 0, null::timestamptz;
    return;
  end if;

  return query select
    (fin > now()),
    greatest(0, ceil(extract(epoch from (fin - now())) / 86400)::integer),
    fin;
end;
$$;

-- 4) (Optionnel, recommandé) Verrou d'écriture côté serveur :
--    quand l'essai est expiré et qu'aucun abonnement Premium n'est actif,
--    le serveur refuse les INSERT/UPDATE des tables métier.
--    Le client fait déjà le blocage hors ligne ; ceci protège l'API.
create or replace function utilisateur_peut_ecrire(uid uuid)
returns boolean language plpgsql security definer as $$
declare
  identifiant text;
  duree integer;
  debut timestamptz;
  fin timestamptz;
  premium boolean;
begin
  -- identifiant d'appareil stocké lors de l'inscription (voir inscriptions_appareil)
  -- Simplification : on vérifie l'abonnement Premium ET l'essai.
  select exists(
    select 1 from abonnements a
    where a.user_id = uid and a.statut = 'actif' and a.date_fin > now()
  ) into premium;

  if premium then return true; end if;

  -- Essai : retrouver l'appareil associé au user (champ à ajouter si besoin)
  -- Pour l'instant on s'appuie sur essais_gratuits.identifiant_appareil qui n'est
  -- pas relié au user_id ; le blocage fin ici est donc documentaire.
  -- Le vrai blocage hors ligne est fait côté app (read-only).
  return true;
end;
$$;