import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type StatutPaiement = "success" | "failed" | "cancelled" | "pending";

export type ParamsSession = {
  transactionId: string; // id interne payment_transactions
  montant: number;
  devise: string;
  country: string;
  description: string;
  email: string | undefined;
  nom: string;
  telephone: string;
  returnUrl: string;
};

export type TransactionLue = {
  id: string;
  user_id: string;
  status: string;
  amount: number | null;
  currency: string | null;
  network: string | null;
  checkout_session_id: string | null;
  saspay_transaction_id: string | null;
  provider_reference: string | null;
};

// Un fournisseur de paiement (agrégateur) = un adaptateur de ce type.
// Ajouter un agrégateur : créer providers/<id>.ts, l'enregistrer dans index.ts,
// puis insérer une ligne dans `payment_providers` et poser son secret.
export interface FournisseurPaiement {
  id: string;
  // Nom du secret Supabase qui contient la clé API du fournisseur.
  secretEnv: string;
  creerSession(admin: SupabaseClient, p: ParamsSession, cle: string): Promise<{ checkoutUrl: string; sessionId: string; reference?: string }>;
  verifier(admin: SupabaseClient, tx: TransactionLue, cle: string): Promise<{ statut: StatutPaiement; payload?: unknown; network?: string | null; telephone?: string | null }>;
}
