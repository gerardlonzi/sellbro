-- ============================================================================
-- Cikap — migration de COHÉRENCE (à exécuter UNE fois, ré-exécutable sans risque)
--
--  1. Plans : modèle canonique Gratuit / Starter / Premium aligné sur l'app
--  2. mon_plan() : lecture fiable du plan + expiration (remplace la lecture de la vue)
--  3. Paiement multi-agrégateurs piloté par la base (payment_providers)
--  4. IA multi-fournisseurs avec basculement (ia_providers + journal ia_appels_log)
--  5. Préférences utilisateur synchronisées (preferences_utilisateur)
--  6. Réparations : profils manquants, droits sur la vue plan_utilisateur
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. PLANS — une seule vérité, lue par l'app (chargerPlans) ET les Edge Functions
-- ---------------------------------------------------------------------------
-- Modèle (identique à lib/plan/quotas.ts) :
--   gratuit : mode après essai, 20 produits, SANS IA, lecture seule hors essai
--   starter : 200 produits, rapports jusqu'au mois, export + cloud, SANS IA
--   premium : illimité + IA (scan 570 / vocal 300 par mois), multi-employés
-- Les PRIX ne sont jamais écrasés ici si la ligne existe déjà : tu les règles
-- toi-même (colonne `prix`, en FCFA/XAF — convertie dans les autres devises
-- avec app_config.taux_conversion, comme dans l'app).
insert into plans (id, nom, actif, prix, quota_vocal, quota_scan, quota_produits, quota_creances, historique_jours, rapports_max, export_comptable, sauvegarde_cloud, multi_employes, support_prioritaire, ordre_affichage) values
  ('gratuit', 'Gratuit', true, 0,    0,   0,   20,   null, null, 'semaine', false, false, false, false, 1),
  ('starter', 'Starter', true, 1500, 0,   0,   200,  null, null, 'mois',    true,  true,  false, false, 2),
  ('premium', 'Premium', true, 2000, 300, 570, null, null, null, 'annee',    true,  true,  true,  true,  3)
on conflict (id) do update set
  nom = excluded.nom,
  actif = true,
  quota_vocal = excluded.quota_vocal,
  quota_scan = excluded.quota_scan,
  quota_produits = excluded.quota_produits,
  quota_creances = excluded.quota_creances,
  historique_jours = excluded.historique_jours,
  rapports_max = excluded.rapports_max,
  export_comptable = excluded.export_comptable,
  sauvegarde_cloud = excluded.sauvegarde_cloud,
  multi_employes = excluded.multi_employes,
  support_prioritaire = excluded.support_prioritaire,
  ordre_affichage = excluded.ordre_affichage,
  updated_at = now();

-- L'essai gratuit se règle dans app_config.duree_essai_jours (lu par
-- demarrer_essai_user ET par l'app) : plus de durée portée par un plan.
update plans set duree_essai_jours = null where id in ('starter', 'premium');
update plans set est_essai_gratuit = (id = 'gratuit');
insert into app_config (cle, valeur, type) values ('duree_essai_jours', '3', 'number')
  on conflict (cle) do nothing;

-- Seuls ces trois identifiants existent (l'app, les fonctions et la vue les supposent).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plans_id_valide') then
    alter table plans add constraint plans_id_valide check (id in ('gratuit', 'starter', 'premium'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. mon_plan() — le plan de l'utilisateur connecté, TOUJOURS une ligne
-- ---------------------------------------------------------------------------
-- Ne dépend pas d'une ligne `profiles` (la vue plan_utilisateur, si) et renvoie
-- aussi la date d'expiration en un seul aller-retour réseau.
create or replace function public.mon_plan()
returns table (plan_id text, date_expiration timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(a.plan_id, 'gratuit')::text, a.date_expiration
  from (select 1) x
  left join lateral (
    select ab.plan_id, ab.date_expiration
    from abonnements ab
    where ab.user_id = auth.uid()
      and ab.statut = 'actif'
      and (ab.date_expiration is null or ab.date_expiration > now())
    order by ab.date_expiration desc nulls first, ab.date_debut desc
    limit 1
  ) a on true;
$$;
revoke all on function public.mon_plan() from public;
grant execute on function public.mon_plan() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. PAIEMENT multi-agrégateurs (piloté par la base)
-- ---------------------------------------------------------------------------
alter table payment_transactions add column if not exists provider text not null default 'saspay';
alter table payment_transactions add column if not exists provider_reference text;
alter table payment_transactions add column if not exists plan_id text;
create index if not exists payment_transactions_provider_ref_idx on payment_transactions (provider_reference);

create table if not exists payment_providers (
  id text primary key,                          -- 'saspay' | 'flutterwave' | …
  nom text not null,
  actif boolean not null default false,         -- INTERRUPTEUR : false = jamais utilisé
  priorite integer not null default 100,        -- plus petit = essayé en premier
  pays text[] not null default '{}',            -- vide = tous les pays
  devises text[] not null default '{}',         -- vide = toutes les devises
  note text,
  updated_at timestamptz not null default now()
);
alter table payment_providers enable row level security;   -- aucune policy : service role uniquement

insert into payment_providers (id, nom, actif, priorite, note) values
  ('saspay',      'SasPay',      true,  10, 'Agrégateur Mobile Money principal'),
  ('flutterwave', 'Flutterwave', false, 20, 'Secours — activer après avoir posé FLUTTERWAVE_SECRET_KEY / FLUTTERWAVE_SECRET_HASH')
on conflict (id) do nothing;

-- Exemples :
--   couper SasPay (panne)  : update payment_providers set actif=false where id='saspay';
--   activer le secours     : update payment_providers set actif=true  where id='flutterwave';
--   forcer un ordre        : update payment_providers set priorite=5 where id='flutterwave';

-- ---------------------------------------------------------------------------
-- 4. IA (OCR scan + transcription vocale) multi-fournisseurs avec basculement
-- ---------------------------------------------------------------------------
create table if not exists ia_providers (
  id text primary key,                          -- 'openai' | 'gemini' | 'grok'
  nom text not null,
  actif boolean not null default false,
  priorite integer not null default 100,
  capacites text[] not null default '{vision,audio}',
  modele_vision text,                           -- null = modèle par défaut du code
  modele_audio text,
  delai_ms integer,                             -- délai max par appel avant de basculer
  note text,
  updated_at timestamptz not null default now()
);
alter table ia_providers enable row level security;

insert into ia_providers (id, nom, actif, priorite, capacites, note) values
  ('openai', 'OpenAI', true,  10, '{vision,audio}', 'Principal — secret OPENAI_API_KEY'),
  ('gemini', 'Google Gemini', true, 20, '{vision,audio}', 'Secours 1 — secret GEMINI_API_KEY (ignoré tant que la clé est absente)'),
  ('grok',   'xAI Grok', true, 30, '{vision}', 'Secours 2 (scan seulement) — secret XAI_API_KEY (ignoré tant que la clé est absente)')
on conflict (id) do nothing;

-- Journal des appels IA : qui a répondu, combien de temps, pourquoi un échec.
create table if not exists ia_appels_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  capacite text not null,                       -- 'vision' | 'audio'
  fournisseur text not null,
  ok boolean not null,
  duree_ms integer,
  erreur text,
  created_at timestamptz not null default now()
);
create index if not exists ia_appels_log_date_idx on ia_appels_log (created_at desc);
alter table ia_appels_log enable row level security;

alter table document_scans add column if not exists fournisseur_ia text;

-- ---------------------------------------------------------------------------
-- 5. PRÉFÉRENCES utilisateur (notifications, thème, modes d'affichage, objectif…)
-- ---------------------------------------------------------------------------
-- Une ligne par utilisateur ; `donnees` = { "<clé>": { "v": "<valeur>", "t": <horodatage ms> } }.
-- L'app écrit d'abord en local (hors ligne OK) puis fusionne : le plus récent gagne.
create table if not exists preferences_utilisateur (
  user_id uuid primary key references auth.users(id) on delete cascade,
  donnees jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table preferences_utilisateur enable row level security;

drop policy if exists "prefs_select" on preferences_utilisateur;
drop policy if exists "prefs_insert" on preferences_utilisateur;
drop policy if exists "prefs_update" on preferences_utilisateur;
create policy "prefs_select" on preferences_utilisateur for select using (auth.uid() = user_id);
create policy "prefs_insert" on preferences_utilisateur for insert with check (auth.uid() = user_id);
create policy "prefs_update" on preferences_utilisateur for update using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. RÉPARATIONS
-- ---------------------------------------------------------------------------
-- Profils manquants (clé étrangère des scans, vue plan_utilisateur…).
insert into profiles (id, email)
select u.id, u.email from auth.users u
where not exists (select 1 from profiles p where p.id = u.id)
on conflict do nothing;

-- La vue plan_utilisateur listait le plan de TOUS les comptes à n'importe quel
-- utilisateur connecté. L'app lit désormais mon_plan() ; seules les Edge
-- Functions (service role) lisent encore la vue.
revoke select on plan_utilisateur from anon, authenticated;
