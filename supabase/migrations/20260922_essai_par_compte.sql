-- ============================================================
-- ESSAI GRATUIT PAR COMPTE (anti-abus) + durée configurable
-- Requis par l'app : lib/trial/deviceTrial.ts appelle le RPC
-- `demarrer_essai_user(p_user_id)`. Sans cette migration, l'app
-- retombe sur le cache local et « X jours restants » ne bouge pas.
-- ============================================================

-- 1) Durée d'essai configurable (3 jours par défaut).
insert into app_config (cle, valeur, type) values
  ('duree_essai_jours', '3', 'number')
on conflict (cle) do update set valeur = excluded.valeur;

-- 2) L'essai est lié au COMPTE (user_id), pas à l'appareil :
--    un utilisateur ayant épuisé son essai ne peut pas en redémarrer
--    un sur un autre appareil.
alter table essais_gratuits add column if not exists user_id uuid references auth.users(id);

-- ADD CONSTRAINT IF NOT EXISTS n'existe pas en PostgreSQL : on vérifie d'abord.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'essais_gratuits_user_unique') then
    alter table essais_gratuits add constraint essais_gratuits_user_unique unique (user_id);
  end if;
end $$;

-- 3) Démarrer / vérifier l'essai — date de fin calculée CÔTÉ SERVEUR
--    (now() serveur), donc insensible à la date du téléphone et
--    fonctionne hors ligne côté client via le cache local.
create or replace function demarrer_essai_user(p_user_id uuid)
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
    from essais_gratuits where user_id = p_user_id;

  if fin is not null then
    return query select debut, fin,
      greatest(0, ceil(extract(epoch from (fin - now())) / 86400)::integer);
    return;
  end if;

  debut := now();
  fin := debut + (duree * interval '1 day');

  insert into essais_gratuits (user_id, identifiant_appareil, date_debut, date_fin)
    values (p_user_id, p_user_id::text, debut, fin)
    on conflict (user_id) do nothing;

  return query select debut, fin,
    greatest(0, ceil(extract(epoch from (fin - now())) / 86400)::integer);
end;
$$;
