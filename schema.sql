-- ============================================================
-- BOUTIKA — Schéma complet Supabase (PostgreSQL)
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILS
-- ------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  telephone text,
  telephone_verifie boolean not null default false,
  nom_boutique text,
  secteur text,
  langue text not null default 'fr',
  devise text not null default 'XAF',
  pays_code text not null default 'CM',
  theme text not null default 'auto',
  created_at timestamptz not null default now()
);

-- Crée automatiquement le profil dès qu'un compte auth est créé (signup email OTP)
create function public.gerer_nouvel_utilisateur()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.gerer_nouvel_utilisateur();

-- ------------------------------------------------------------
-- 2. PLANS — configuration entièrement pilotable depuis la DB
--    Modifier une ligne ici change immédiatement le comportement
--    de l'app pour tous les utilisateurs, sans nouvelle version.
-- ------------------------------------------------------------
create table plans (
  id text primary key,                    -- 'gratuit' | 'starter' | 'premium'
  nom text not null,
  actif boolean not null default true,    -- passer à false = retire ce plan de l'app (ex: plus de gratuit)
  prix integer not null default 0,        -- en FCFA
  quota_vocal integer not null default 0, -- nombre de vocaux / mois
  quota_scan integer not null default 0,
  quota_produits integer,                 -- null = illimité
  quota_creances integer,                 -- null = illimité
  historique_jours integer,               -- null = illimité
  rapports_max text not null default 'jour', -- 'jour' | 'semaine' | 'mois' | 'semestre' | 'annee'
  export_comptable boolean not null default false,
  sauvegarde_cloud boolean not null default false,
  multi_employes boolean not null default false,
  support_prioritaire boolean not null default false,
  ordre_affichage integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table plans add column duree_essai_jours integer; -- null = pas d'essai, sinon nombre de jours
alter table plans add column est_essai_gratuit boolean not null default false;

-- Configuration "payant avec essai" : le plan gratuit permanent est désactivé,
-- et Starter devient accessible via un essai de 14 jours avant paiement
update plans set actif = false where id = 'gratuit';
update plans set duree_essai_jours = 14 where id = 'starter';

insert into plans (id, nom, actif, prix, quota_vocal, quota_scan, quota_produits, quota_creances, historique_jours, rapports_max, export_comptable, sauvegarde_cloud, multi_employes, support_prioritaire, ordre_affichage) values
  ('gratuit', 'Gratuit', true, 0, 4, 4, 30, 15, 7, 'semaine', false, false, false, false, 1),
  ('starter', 'Starter', true, 1500, 150, 350, null, null, null, 'semestre', true, true, false, false, 2),
  ('premium', 'Premium', true, 2000, 300, 570, null, null, null, 'annee', true, true, true, true, 3);

-- Exemple d'usage plus tard : désactiver le plan gratuit sans toucher au code
-- update plans set actif = false where id = 'gratuit';
-- Exemple : réduire les scans du plan starter
-- update plans set quota_scan = 250 where id = 'starter';

-- ------------------------------------------------------------
-- 3. ABONNEMENTS (statut réel de chaque utilisateur)
-- ------------------------------------------------------------
create table abonnements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  plan_id text not null references plans(id),
  statut text not null default 'actif',   -- 'actif' | 'expire' | 'en_attente_paiement' | 'annule'
  date_debut timestamptz not null default now(),
  date_expiration timestamptz,
  montant_paye integer,                   -- snapshot du prix payé, protège des changements de prix futurs
  moyen_paiement text,                    -- 'mtn_momo' | 'orange_money'
  reference_transaction text,
  created_at timestamptz not null default now()
);
create index idx_abonnements_user on abonnements(user_id);

-- Plan effectif de chaque utilisateur (le plus récent abonnement actif, sinon gratuit)
create view plan_utilisateur as
  select
    p.id as user_id,
    coalesce(
      (select a.plan_id from abonnements a
       where a.user_id = p.id and a.statut = 'actif' and (a.date_expiration is null or a.date_expiration > now())
       order by a.date_debut desc limit 1),
      'gratuit'
    ) as plan_id
  from profiles p;

-- ------------------------------------------------------------
-- 4. ESSAI GRATUIT PAR APPAREIL (pas besoin de compte)
-- ------------------------------------------------------------
create table essais_gratuits (
  id uuid primary key default gen_random_uuid(),
  identifiant_appareil text unique not null,
  date_debut timestamptz not null default now(),
  date_fin timestamptz not null
);

-- ------------------------------------------------------------
-- 5. ANTI-BOT — limite le nombre de comptes créés par appareil
-- ------------------------------------------------------------
create table inscriptions_appareil (
  identifiant_appareil text primary key,
  nombre_comptes integer not null default 1,
  premiere_inscription timestamptz not null default now(),
  derniere_inscription timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 6. CONFIG GLOBALE — pour tout ce qui n'est pas lié à un plan
-- ------------------------------------------------------------
create table app_config (
  cle text primary key,
  valeur text not null,
  type text not null,   -- 'boolean' | 'number' | 'string' | 'secret' | 'liste'
  updated_at timestamptz not null default now()
);

insert into app_config (cle, valeur, type) values
  ('ai_features_enabled', 'false', 'boolean'),
  ('openai_api_key', '', 'secret'),
  ('google_vision_api_key', '', 'secret'),
  ('duree_max_vocal_secondes', '15', 'number'),
  ('mode_paiement_actif', '["mtn_momo","orange_money"]', 'liste'),
  ('max_comptes_par_appareil', '3', 'number');

-- ------------------------------------------------------------
-- 7. PROMOTIONS
-- ------------------------------------------------------------
create table promotions (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  plan_id text references plans(id),      -- null = s'applique à tous les plans
  pourcentage_reduction integer,
  montant_fixe_reduction integer,
  date_debut timestamptz not null,
  date_fin timestamptz not null,
  actif boolean not null default true,
  condition text
);

-- ------------------------------------------------------------
-- 8. CATÉGORIES
-- ------------------------------------------------------------
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  nom text not null,
  created_at timestamptz not null default now(),
  unique (user_id, nom)
);

-- ------------------------------------------------------------
-- 9. PRODUITS — champs_supplementaires en jsonb pour tout champ
--    facultatif ajouté dynamiquement (couleur, poids, image, etc.)
-- ------------------------------------------------------------
create table produits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  categorie_id uuid references categories(id) on delete set null,
  nom text not null,
  prix_vente integer not null,
  prix_achat integer,
  quantite_stock integer not null default 0,
  seuil_alerte integer not null default 5,
  champs_supplementaires jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_produits_user on produits(user_id);
create index idx_produits_champs_supp on produits using gin (champs_supplementaires);

-- ------------------------------------------------------------
-- 10. VENTES — donnees_supplementaires en jsonb pour toute
--     information extraite d'une facture complexe (30+ colonnes
--     possibles sans jamais modifier ce schéma)
-- ------------------------------------------------------------
create table ventes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  produit_id uuid references produits(id) on delete set null,
  quantite integer not null,
  prix_unitaire integer not null,
  client_nom text,
  client_telephone text,
  mode_paiement text,                     -- 'cash' | 'momo' | 'orange_money' | 'credit'
  source text not null default 'manuel',  -- 'manuel' | 'vocal' | 'scan'
  audio_url text,
  image_facture_url text,
  donnees_supplementaires jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_ventes_user_date on ventes(user_id, created_at desc);
create index idx_ventes_donnees_supp on ventes using gin (donnees_supplementaires);

-- ------------------------------------------------------------
-- 11. ACHATS (réassorts / factures fournisseurs)
-- ------------------------------------------------------------
create table achats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  fournisseur_nom text,
  description text,
  montant integer not null,
  source text not null default 'manuel',
  facture_image_url text,
  donnees_supplementaires jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_achats_user on achats(user_id);

-- ------------------------------------------------------------
-- 12. CRÉANCES ET DETTES
-- ------------------------------------------------------------
create table creances_dettes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,                     -- 'creance' | 'dette'
  personne_nom text not null,
  telephone text,
  montant_initial integer not null,
  montant_restant integer not null,
  date_echeance date,
  statut text not null default 'en_cours', -- 'en_cours' | 'payee' | 'en_retard'
  note text,
  produit_concerne text,
  created_at timestamptz not null default now()
);
create index idx_creances_user on creances_dettes(user_id);

create table paiements_creances (
  id uuid primary key default gen_random_uuid(),
  creance_id uuid not null references creances_dettes(id) on delete cascade,
  montant integer not null,
  paye_le timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 13. NOTIFICATIONS
-- ------------------------------------------------------------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,  -- creance_retard | echeance_proche | stock_faible | rupture_stock
                        -- sync_ok | sync_echec | quota_bientot_epuise | quota_epuise
                        -- fin_essai_proche | palier_atteint | abonnement_confirme | abonnement_expire
  message text not null,
  lu boolean not null default false,
  lien text,            -- route interne à ouvrir au tap, ex: '/creances'
  created_at timestamptz not null default now()
);
create index idx_notifications_user on notifications(user_id, created_at desc);

-- ------------------------------------------------------------
-- 14. EMPLOYÉS (Premium uniquement, géré côté app)
-- ------------------------------------------------------------
create table employes (
  id uuid primary key default gen_random_uuid(),
  proprietaire_id uuid not null references profiles(id) on delete cascade,
  nom text not null,
  telephone text,
  role text not null default 'vendeur',   -- 'vendeur' | 'gestionnaire'
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 15. SÉCURITÉ (RLS — chacun ne voit que ses propres données)
-- ------------------------------------------------------------
alter table profiles enable row level security;
alter table produits enable row level security;
alter table ventes enable row level security;
alter table achats enable row level security;
alter table creances_dettes enable row level security;
alter table paiements_creances enable row level security;
alter table notifications enable row level security;
alter table categories enable row level security;
alter table abonnements enable row level security;
alter table employes enable row level security;

create policy "Chacun voit son propre profil" on profiles
  for all using (auth.uid() = id);
create policy "Chacun voit ses propres données" on produits
  for all using (auth.uid() = user_id);
create policy "Chacun voit ses propres données" on ventes
  for all using (auth.uid() = user_id);
create policy "Chacun voit ses propres données" on achats
  for all using (auth.uid() = user_id);
create policy "Chacun voit ses propres données" on creances_dettes
  for all using (auth.uid() = user_id);
create policy "Chacun voit ses propres données" on paiements_creances
  for all using (auth.uid() = (select user_id from creances_dettes where id = creance_id));
create policy "Chacun voit ses propres données" on notifications
  for all using (auth.uid() = user_id);
create policy "Chacun voit ses propres données" on categories
  for all using (auth.uid() = user_id);
create policy "Chacun voit ses propres données" on abonnements
  for all using (auth.uid() = user_id);
create policy "Chacun voit ses propres données" on employes
  for all using (auth.uid() = proprietaire_id);

-- plans, app_config, promotions restent lisibles par tous (pas de RLS,
-- lecture publique nécessaire pour afficher prix/quotas dans l'app),
-- mais aucune écriture n'est possible depuis l'app (seulement via le
-- tableau de bord Supabase, avec ta clé service_role).
alter table plans enable row level security;
create policy "Lecture publique des plans" on plans for select using (true);

alter table app_config enable row level security;
create policy "Lecture publique de la config" on app_config for select using (true);

alter table promotions enable row level security;
create policy "Lecture publique des promotions" on promotions for select using (true);