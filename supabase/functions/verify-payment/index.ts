// Edge Function : vérification de secours d'un paiement resté "pending".
// Appelée par l'app (bouton « Vérifier le statut », reprise au retour du
// navigateur) — interroge le fournisseur qui a créé la transaction et applique
// la même activation que le webhook si le paiement est confirmé.
//
// Déploiement : supabase functions deploy verify-payment
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { activerAbonnement } from "../_shared/activerAbonnement.ts";
import { CORS, json } from "../_shared/pays.ts";
import { REGISTRE } from "../_shared/providers/index.ts";

// Répare les paiements confirmés jamais activés : transaction `success` récente
// de l'utilisateur et AUCUN abonnement actif → on l'active.
async function reparerSiNecessaire(
  admin: SupabaseClient,
  userId: string,
  transaction: { id: string; user_id: string; network: string | null } | null
): Promise<boolean> {
  const { data: abo } = await admin
    .from("abonnements").select("id")
    .eq("user_id", userId).eq("statut", "actif")
    .gt("date_expiration", new Date().toISOString())
    .limit(1).maybeSingle();
  if (abo) return false;

  let tx = transaction;
  if (!tx) {
    const { data } = await admin
      .from("payment_transactions").select("id, user_id, network")
      .eq("user_id", userId).eq("status", "success")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    tx = data;
  }
  if (!tx) return false;

  // Cette transaction a déjà donné lieu à un abonnement (aujourd'hui expiré) :
  // la « réparer » offrirait un mois gratuit à chaque vérification.
  const { data: dejaUtilisee } = await admin
    .from("abonnements").select("id").eq("reference_transaction", tx.id).limit(1).maybeSingle();
  if (dejaUtilisee) return false;

  await activerAbonnement(admin, { transactionId: tx.id, userId: tx.user_id, phone: null, network: tx.network });
  console.log(`réparation: abonnement activé user=${userId} transaction=${tx.id}`);
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "non authentifié", code: "non_authentifie" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const clientUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: errAuth } = await clientUser.auth.getUser();
    if (errAuth || !user) return json({ error: "session invalide", code: "session_invalide" }, 401);

    const { transaction_id } = await req.json();
    if (!transaction_id) return json({ error: "transaction_id requis" }, 400);

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: transaction } = await admin
      .from("payment_transactions")
      .select("id, user_id, status, provider, amount, currency, saspay_transaction_id, checkout_session_id, provider_reference, network")
      .eq("id", transaction_id).eq("user_id", user.id).maybeSingle();
    if (!transaction) return json({ error: "transaction introuvable", code: "transaction_introuvable" }, 404);

    if (transaction.status !== "pending") {
      if (transaction.status === "success") {
        const reparee = await reparerSiNecessaire(admin, user.id, transaction);
        return json({ status: reparee ? "success" : transaction.status });
      }
      return json({ status: transaction.status });
    }
    {
      const reparee = await reparerSiNecessaire(admin, user.id, null);
      if (reparee) return json({ status: "success" });
    }

    const fournisseur = REGISTRE[transaction.provider ?? "saspay"];
    const cle = fournisseur ? Deno.env.get(fournisseur.secretEnv) : null;
    if (!fournisseur || !cle) return json({ status: "pending" });

    const resultat = await fournisseur.verifier(admin, transaction, cle);

    if (resultat.statut === "success") {
      await activerAbonnement(admin, {
        transactionId: transaction.id,
        userId: transaction.user_id,
        phone: resultat.telephone ?? null,
        network: resultat.network ?? transaction.network,
        payload: resultat.payload,
      });
      return json({ status: "success" });
    }
    if (resultat.statut === "failed" || resultat.statut === "cancelled") {
      await admin.from("payment_transactions")
        .update({ status: resultat.statut, raw_webhook_payload: resultat.payload ?? null, updated_at: new Date().toISOString() })
        .eq("id", transaction.id);
      return json({ status: resultat.statut });
    }
    return json({ status: "pending" });
  } catch (e) {
    console.error("verify-payment:", e);
    return json({ error: `erreur interne: ${e}`, code: "erreur_interne" }, 500);
  }
});
