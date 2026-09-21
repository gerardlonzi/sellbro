-- Paiement d'abonnement via SasPay (Mobile Money MTN/Orange Cameroun)

-- Extension de l'abonnement existant : numéro et réseau utilisés pour le
-- dernier paiement (éditables, jamais imposés depuis le profil — l'utilisateur
-- ne vérifie que son email, le numéro de paiement peut être une autre ligne).
alter table abonnements
  add column if not exists payment_phone text,
  add column if not exists payment_network text;

-- Prix par devise pour les pays hors XAF (SasPay ne convertit pas les
-- montants Mobile Money). Ex. : {"XOF": 2000, "GHS": 50, "KES": 650, "CDF": 9000}
alter table plans
  add column if not exists prix_par_devise jsonb;

-- Historique / traçabilité des paiements.
create table if not exists payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  saspay_transaction_id text,
  idempotency_key text not null unique,
  amount numeric not null,
  currency text not null default 'XAF',
  network text not null,
  status text not null default 'pending'
    check (status in ('pending','success','failed','cancelled')),
  raw_webhook_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table payment_transactions enable row level security;

-- Lecture seule pour le propriétaire (statut affiché dans l'app) ;
-- toutes les écritures passent par les Edge Functions (service role).
create policy "lecture propre" on payment_transactions
  for select using (auth.uid() = user_id);

-- Realtime : l'app écoute le changement de statut de sa transaction.
alter publication supabase_realtime add table payment_transactions;
