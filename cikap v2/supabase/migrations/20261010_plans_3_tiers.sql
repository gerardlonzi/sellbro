-- ============================================================================
-- Plans 3 formules : Gratuit / Starter / Premium
--  - Gratuit : après l'essai, catalogue limité (20 produits), sans IA.
--  - Starter : catalogue étendu (200 produits), fonctionnalités avancées,
--              SANS IA (scan intelligent / vocal réservés au Premium).
--  - Premium : illimité + IA.
-- Toutes les limites vivent ICI (table plans) : l'app les lit via
-- chargerPlans() — modifier une limite = UPDATE, pas une nouvelle version.
-- ============================================================================

-- Gratuit : réactivé (c'est le mode post-essai), produits limités à 20,
-- pas de quotas IA.
update plans set
  actif = true,
  est_essai_gratuit = true,
  quota_produits = 20,
  quota_vocal = 0,
  quota_scan = 0,
  rapports_max = 'semaine',
  export_comptable = false,
  sauvegarde_cloud = false,
  multi_employes = false,
  support_prioritaire = false,
  updated_at = now()
where id = 'gratuit';

-- Starter : 200 produits, rapports jusqu'au mois, sauvegarde cloud, sans IA.
insert into plans (id, nom, actif, prix, quota_vocal, quota_scan, quota_produits, quota_creances, historique_jours, rapports_max, export_comptable, sauvegarde_cloud, multi_employes, support_prioritaire, ordre_affichage) values
  ('starter', 'Starter', true, 1500, 0, 0, 200, null, null, 'mois', true, true, false, false, 2)
on conflict (id) do update set
  actif = true,
  quota_produits = 200,
  quota_vocal = 0,
  quota_scan = 0,
  rapports_max = 'mois',
  export_comptable = true,
  sauvegarde_cloud = true,
  duree_essai_jours = null,
  updated_at = now();

-- Premium : tout illimité + IA (scan de documents, vocal).
update plans set
  actif = true,
  quota_produits = null,
  quota_creances = null,
  historique_jours = null,
  rapports_max = 'annee',
  export_comptable = true,
  sauvegarde_cloud = true,
  multi_employes = true,
  support_prioritaire = true,
  updated_at = now()
where id = 'premium';

-- Le checkout SasPay mémorise le plan choisi (starter | premium) pour que le
-- webhook active le BON plan après paiement (activerAbonnement le lit).
alter table payment_transactions add column if not exists plan_id text;
