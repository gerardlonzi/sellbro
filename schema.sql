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
  -- Statut de vérification de l'email : false tant que l'utilisateur n'a pas
  -- saisi le code reçu par email. Permet de détecter au redémarrage qu'une
  -- vérification est en attente et de rediriger de force vers l'écran du code.
  is_verified boolean not null default false,
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
-- 16. FOURNISSEURS
-- ------------------------------------------------------------
create table fournisseurs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  nom text not null,
  telephone text,
  adresse text,
  total_achats integer not null default 0,
  montant_du integer not null default 0,
  created_at timestamptz not null default now()
);
create index idx_fournisseurs_user on fournisseurs(user_id);

-- Relie les achats existants à un fournisseur réel (au lieu du simple texte libre)
alter table achats add column fournisseur_id uuid references fournisseurs(id) on delete set null;

-- ------------------------------------------------------------
-- 17. DETTES FOURNISSEURS — même logique que creances_dettes,
--     mais on réutilise directement creances_dettes avec type='dette'
--     et on ajoute juste le lien vers le fournisseur.
-- ------------------------------------------------------------
alter table creances_dettes add column fournisseur_id uuid references fournisseurs(id) on delete set null;

-- ------------------------------------------------------------
-- 18. DÉPENSES
-- ------------------------------------------------------------
create table depenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  categorie text not null, -- 'loyer' | 'electricite' | 'transport' | 'salaire' | 'internet' | 'emballage' | 'maintenance' | 'marketing' | 'autre'
  description text,
  montant integer not null,
  donnees_supplementaires jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_depenses_user_date on depenses(user_id, created_at desc);

-- ------------------------------------------------------------
-- 19. FACTURES — générées depuis une ou plusieurs ventes
-- ------------------------------------------------------------
create table factures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  numero text not null, -- ex: INV-000124, généré côté app
  client_nom text,
  client_telephone text,
  sous_total integer not null,
  remise integer not null default 0,
  total integer not null,
  statut text not null default 'brouillon', -- 'brouillon' | 'en_attente' | 'payee' | 'partiellement_payee' | 'en_retard' | 'annulee'
  montant_paye integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, numero)
);
create index idx_factures_user on factures(user_id);

create table facture_lignes (
  id uuid primary key default gen_random_uuid(),
  facture_id uuid not null references factures(id) on delete cascade,
  vente_id uuid references ventes(id) on delete set null,
  produit_nom text not null,
  quantite integer not null,
  prix_unitaire integer not null
);

-- ------------------------------------------------------------
-- 20. MOUVEMENTS DE STOCK — historique complet, jamais juste
--     "stock = 25" sans traçabilité
-- ------------------------------------------------------------
create table mouvements_stock (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  produit_id uuid not null references produits(id) on delete cascade,
  type text not null, -- 'achat' | 'vente' | 'retour' | 'casse' | 'ajustement' | 'transfert' | 'peremption'
  quantite integer not null, -- positif = entrée, négatif = sortie
  stock_avant integer not null,
  stock_apres integer not null,
  raison text,
  reference_id uuid, -- id de la vente/achat à l'origine du mouvement, si applicable
  created_at timestamptz not null default now()
);
create index idx_mouvements_produit on mouvements_stock(produit_id, created_at desc);

-- ------------------------------------------------------------
-- 21. RLS pour les nouvelles tables
-- ------------------------------------------------------------
alter table fournisseurs enable row level security;
alter table depenses enable row level security;
alter table factures enable row level security;
alter table facture_lignes enable row level security;
alter table mouvements_stock enable row level security;

create policy "Chacun voit ses propres données" on fournisseurs
  for all using (auth.uid() = user_id);
create policy "Chacun voit ses propres données" on depenses
  for all using (auth.uid() = user_id);
create policy "Chacun voit ses propres données" on factures
  for all using (auth.uid() = user_id);
create policy "Chacun voit ses propres données" on facture_lignes
  for all using (auth.uid() = (select user_id from factures where id = facture_id));
create policy "Chacun voit ses propres données" on mouvements_stock
  for all using (auth.uid() = user_id);


  alter table plans add column factures_actif boolean not null default false;
alter table plans add column fournisseurs_actif boolean not null default false;
alter table plans add column depenses_actif boolean not null default false;

update plans set factures_actif = true, fournisseurs_actif = true, depenses_actif = true where id in ('starter', 'premium');

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

-- ------------------------------------------------------------
-- 22. EMAIL — vérification et changement d'email sans doublon
-- ------------------------------------------------------------
-- Migration pour les bases déjà déployées (sans risque si la colonne existe déjà).
alter table profiles add column if not exists is_verified boolean not null default false;

-- Le code OTP lui-même est généré, stocké (haché) et validé par Supabase Auth
-- (signInWithOtp / verifyOtp). On ne le duplique PAS en clair dans profiles :
-- c'est plus sûr. Ici, on suit uniquement le statut is_verified.

-- Quand l'utilisateur change d'email AVANT vérification, signInWithOtp crée un
-- nouvel utilisateur (nouvel email = nouvelle identité) et le trigger recrée un
-- profil. Cette fonction supprime l'ANCIEN profil non vérifié pour éviter le
-- doublon dans la table profiles.
create or replace function public.supprimer_profil_non_verifie(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.profiles
  where email = p_email
    and is_verified = false;
end;
$$;

-- Appelable depuis l'app (client anonyme ou connecté) pour le nettoyage.
grant execute on function public.supprimer_profil_non_verifie(text) to anon, authenticated;

-- Sauvegarde toutes les infos du profil dès l'inscription (avant vérification,
-- donc sans session). Appelée depuis l'app via RPC, au moment où l'utilisateur
-- clique sur "Continuer" dans le formulaire de configuration de la boutique.
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
  update public.profiles
  set nom_boutique = p_nom_boutique,
      telephone = p_telephone,
      langue = p_langue,
      devise = p_devise,
      pays_code = p_pays_code
  where email = p_email;
end;
$$;

grant execute on function public.sauvegarder_profil_inscription(text, text, text, text, text, text) to anon, authenticated;
-- ------------------------------------------------------------
-- 23. JOURNAL D'ACTIVITÉ — audit local synchronisé dans le cloud
-- ------------------------------------------------------------
create table if not exists journal_activite (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,     -- 'produit' | 'vente' | 'achat' | 'creance' | 'depense' | 'fournisseur' | 'facture' | 'stock' | ...
  action text not null,   -- 'ajout' | 'modification' | 'suppression' | 'alerte'
  description text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_journal_user on journal_activite(user_id, created_at desc);

alter table journal_activite enable row level security;
drop policy if exists "Chacun voit ses propres données" on journal_activite;
create policy "Chacun voit ses propres données" on journal_activite
  for all using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 24. TAUX DE CONVERSION (source unique pour les devises)
--     JSON : { "NGN": 0.42, ... } où la valeur = unités de la devise
--     pour 1 FCFA (XAF). Pilotable depuis Supabase (app_config), sans
--     republier l'app.
-- ------------------------------------------------------------
insert into app_config (cle, valeur, type) values
  ('taux_conversion', '{"XAF":1,"XOF":1,"NGN":0.42,"GHS":0.015,"ZAR":0.032,"KES":0.21,"UGX":6.1,"TZS":4.4,"RWF":2.2,"BIF":5.0,"CDF":4.8,"EGP":0.082,"MAD":0.017,"DZD":0.23,"TND":0.0054,"LYD":0.0082,"SDG":1.0,"SSP":0.22,"ETB":0.19,"SOS":0.95,"DJF":0.30,"ERN":0.025,"MWK":2.9,"ZMW":0.045,"BWP":0.023,"NAD":0.032,"SZL":0.032,"LSL":0.032,"MZN":0.11,"AOA":1.5,"SCR":0.024,"MUR":0.077,"KMF":0.82,"CVE":0.17,"GMD":0.11,"SLL":0.037,"LRD":0.31,"GNF":14.7}', 'string')
on conflict (cle) do update set valeur = excluded.valeur;
