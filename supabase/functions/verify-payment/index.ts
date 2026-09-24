// Edge Function : vérification de secours d'un paiement resté "pending".
// Appelée par l'app (bouton « Vérifier le statut » après ~2 min d'attente,
// ou reprise d'une transaction en attente) — interroge SasPay et applique la
// même activation que le webhook si le paiement est confirmé.
//
// Déploiement : supabase functions deploy verify-payment
// Secret requis : SASPAY_SECRET_KEY
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { activerAbonnement } from "../_shared/activerAbonnement.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Répare les paiements confirmés jamais activés : si l'utilisateur a une
// transaction success récente et AUCUN abonnement actif, on l'active.
// `transaction` : transaction déjà chargée (cas success direct), sinon null
// → on cherche la success la plus récente de l'utilisateur.
async function reparerSiNecessaire(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  transaction: { id: string; user_id: string; network: string | null } | null
): Promise<boolean> {
  const { data: abo } = await supabaseAdmin
    .from("abonnements")
    .select("id")
    .eq("user_id", userId)
    .eq("statut", "actif")
    .gt("date_expiration", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (abo) return false; // déjà actif : rien à réparer

  let tx = transaction;
  if (!tx) {
    const { data } = await supabaseAdmin
      .from("payment_transactions")
      .select("id, user_id, network")
      .eq("user_id", userId)
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    tx = data;
  }
  if (!tx) return false;

  await activerAbonnement(supabaseAdmin, {
    transactionId: tx.id,
    userId: tx.user_id,
    phone: null,
    network: tx.network,
  });
  console.log(`réparation: abonnement activé pour user=${userId} via transaction=${tx.id}`);
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "non authentifié" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const saspayKey = Deno.env.get("SASPAY_SECRET_KEY");
    if (!saspayKey) return json({ error: "SasPay non configuré" }, 500);

    const clientUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: errAuth } = await clientUser.auth.getUser();
    if (errAuth || !user) return json({ error: "session invalide" }, 401);

    const { transaction_id } = await req.json();
    if (!transaction_id) return json({ error: "transaction_id requis" }, 400);

    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // La transaction doit appartenir à l'appelant.
    const { data: transaction } = await supabaseAdmin
      .from("payment_transactions")
      .select("id, user_id, status, saspay_transaction_id, checkout_session_id, network")
      .eq("id", transaction_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!transaction) return json({ error: "transaction introuvable" }, 404);

    // Auto-réparation : un paiement confirmé (success) SANS abonnement actif
    // (ex. bug d'activation passé) → on ré-active. On cherche la transaction
    // success la plus récente de l'utilisateur, pas seulement celle demandée :
    // l'app appelle souvent avec une transaction pending plus récente.
    if (transaction.status !== "pending") {
      if (transaction.status === "success") {
        const reparee = await reparerSiNecessaire(supabaseAdmin, user.id, transaction);
        return json({ status: reparee ? "success" : transaction.status });
      }
      return json({ status: transaction.status });
    }
    // Transaction demandée encore pending : avant d'aller interroger SasPay,
    // on vérifie s'il n'existe pas une AUTRE transaction success non activée.
    {
      const reparee = await reparerSiNecessaire(supabaseAdmin, user.id, null);
      if (reparee) return json({ status: "success" });
    }

    // Checkout hébergé sans transaction SasPay connue : on lit la session.
    // La session porte le statut (PENDING/SUCCESS/CANCELLED) et, une fois
    // payée, l'id de la transaction SasPay créée.
    if (!transaction.saspay_transaction_id && transaction.checkout_session_id) {
      const rSession = await fetch(
        `https://api.saspay.me/api/v1/checkout-sessions/${transaction.checkout_session_id}/`,
        { headers: { Authorization: `Bearer ${saspayKey}` } }
      );
      // SasPay enveloppe la réponse : { success, data: {...} }
      const corpsSession = await rSession.json().catch(() => null);
      const session = corpsSession?.data ?? corpsSession;
      if (!rSession.ok || !session) return json({ status: "pending" });

      if (session.transaction) {
        await supabaseAdmin
          .from("payment_transactions")
          .update({ saspay_transaction_id: session.transaction, updated_at: new Date().toISOString() })
          .eq("id", transaction.id);
      }

      const statutSession: string = (session.status ?? "").toUpperCase();
      if (statutSession === "SUCCESS" || statutSession === "PAID") {
        await activerAbonnement(supabaseAdmin, {
          transactionId: transaction.id,
          userId: transaction.user_id,
          phone: session.customer_phone ?? null,
          network: "checkout",
          payload: session,
        });
        return json({ status: "success" });
      }
      if (statutSession === "CANCELLED" || statutSession === "FAILED" || statutSession === "EXPIRED") {
        const statut = statutSession === "CANCELLED" ? "cancelled" : "failed";
        await supabaseAdmin
          .from("payment_transactions")
          .update({ status: statut, raw_webhook_payload: session, updated_at: new Date().toISOString() })
          .eq("id", transaction.id);
        return json({ status: statut });
      }
      return json({ status: "pending" });
    }

    if (!transaction.saspay_transaction_id) return json({ status: "pending" });

    const reponse = await fetch(
      `https://api.saspay.me/api/v1/payments/${transaction.saspay_transaction_id}/verify/`,
      { headers: { Authorization: `Bearer ${saspayKey}` } }
    );
    const corpsSasPay = await reponse.json().catch(() => null);
    const resultat = corpsSasPay?.data ?? corpsSasPay;
    if (!reponse.ok) return json({ status: "pending" });

    const statutSasPay: string = (resultat?.status ?? "").toUpperCase();

    if (statutSasPay === "SUCCESS" || statutSasPay === "SUCCESSFUL" || statutSasPay === "COMPLETED") {
      await activerAbonnement(supabaseAdmin, {
        transactionId: transaction.id,
        userId: transaction.user_id,
        phone: resultat?.customer?.phone ?? null,
        network: resultat?.network ?? transaction.network,
        payload: resultat,
      });
      return json({ status: "success" });
    }

    if (statutSasPay === "FAILED" || statutSasPay === "CANCELLED") {
      const statut = statutSasPay === "FAILED" ? "failed" : "cancelled";
      await supabaseAdmin
        .from("payment_transactions")
        .update({ status: statut, raw_webhook_payload: resultat, updated_at: new Date().toISOString() })
        .eq("id", transaction.id);
      return json({ status: statut });
    }

    return json({ status: "pending" });
  } catch (e) {
    return json({ error: `erreur interne: ${e}` }, 500);
  }
});
