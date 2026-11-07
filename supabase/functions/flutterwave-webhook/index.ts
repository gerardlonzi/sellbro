// Webhook Flutterwave : le header `verif-hash` doit être égal au secret hash
// configuré dans le dashboard Flutterwave (secret FLUTTERWAVE_SECRET_HASH).
// On ne fait PAS confiance au corps : on revérifie la transaction via l'API.
//
// Déploiement : supabase functions deploy flutterwave-webhook (verify_jwt = false)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { activerAbonnement } from "../_shared/activerAbonnement.ts";
import { flutterwave } from "../_shared/providers/flutterwave.ts";

Deno.serve(async (req) => {
  try {
    const attendu = Deno.env.get("FLUTTERWAVE_SECRET_HASH");
    const cle = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
    if (!attendu || !cle) return new Response("non configuré", { status: 500 });
    if (req.headers.get("verif-hash") !== attendu) return new Response("signature invalide", { status: 403 });

    const payload = await req.json();
    const reference: string | undefined = payload?.data?.tx_ref ?? payload?.txRef;
    if (!reference?.startsWith("cikap-")) return new Response("ignoré", { status: 200 });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: tx } = await admin
      .from("payment_transactions")
      .select("id, user_id, status, amount, currency, network, checkout_session_id, saspay_transaction_id, provider_reference")
      .eq("id", reference.replace("cikap-", "")).maybeSingle();
    if (!tx) return new Response("transaction inconnue", { status: 200 });
    if (tx.status !== "pending") return new Response("déjà traité", { status: 200 });

    const r = await flutterwave.verifier(admin, tx, cle);
    if (r.statut === "success") {
      await activerAbonnement(admin, { transactionId: tx.id, userId: tx.user_id, phone: r.telephone ?? null, network: r.network ?? null, payload: r.payload });
    } else if (r.statut === "failed" || r.statut === "cancelled") {
      await admin.from("payment_transactions")
        .update({ status: r.statut, raw_webhook_payload: r.payload ?? null, updated_at: new Date().toISOString() })
        .eq("id", tx.id);
    }
    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response(`erreur: ${e}`, { status: 500 });
  }
});
