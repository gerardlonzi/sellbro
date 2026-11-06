-- Checkout hébergé SasPay : on stocke l'id de la session de checkout pour
-- retrouver la transaction interne quand le webhook arrive (l'id de
-- transaction SasPay n'est connu qu'APRÈS le paiement du client).
alter table payment_transactions
  add column if not exists checkout_session_id text;

create index if not exists payment_transactions_checkout_session_idx
  on payment_transactions (checkout_session_id);
