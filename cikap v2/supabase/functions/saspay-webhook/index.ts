// Edge Function : webhook SasPay — SEULE source de vérité pour confirmer un
// paiement (jamais la réponse de l'appel softpay initial).
//
// Déploiement : supabase functions deploy saspay-webhook
// (config.toml : verify_jwt = false pour cette fonction)
// Secret requis : SASPAY_WEBHOOK_SIGNING_SECRET (copié à la création du
// webhook dans le dashboard SasPay — non ré-affichable ensuite).
//
// Vérifications obligatoires, dans l'ordre :
//   1. Lecture du corps BRUT (jamais de JSON.parse avant la signature)
//   2. Fraîcheur : X-Webhook-Timestamp à ±5 minutes de l'heure serveur
//   3. Signature : HMAC-SHA256(secret, "{timestamp}.{corps}") en temps constant
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { activerAbonnement } from "../_shared/activerAbonnement.ts";

const TOLERANCE_SECONDES = 300;

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Comparaison en temps constant (pas de === sur les signatures).
function comparaisonSure(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  try {
    const secret = Deno.env.get("SASPAY_WEBHOOK_SIGNING_SECRET");
    if (!secret) return new Response("non configuré", { status: 500 });

    // 1) Corps brut.
    const corps = await req.text();

    // 2) Fraîcheur du timestamp (anti-rejeu).
    const timestamp = req.headers.get("X-Webhook-Timestamp");
    if (!timestamp) return new Response("timestamp manquant", { status: 403 });
    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > TOLERANCE_SECONDES) {
      return new Response("timestamp expiré", { status: 403 });
    }

    // 3) Signature HMAC-SHA256 en temps constant.
    const signature = req.headers.get("X-Webhook-Signature") ?? "";
    const cle = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const attendu = hex(await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(`${timestamp}.${corps}`)));
    if (!comparaisonSure(attendu, signature.replace(/^sha256=/, ""))) {
      return new Response("signature invalide", { status: 403 });
    }

    // 4) Traitement de l'événement.
    const payload = JSON.parse(corps);
    const evenement: string = payload.event ?? "";
    const donnees = payload.data ?? payload;
    const saspayId: string | undefined = donnees.id;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Retrouve la transaction interne via l'id SasPay (paiement softpay).
    let { data: transaction } = saspayId
      ? await supabaseAdmin
          .from("payment_transactions")
          .select("id, user_id, status")
          .eq("saspay_transaction_id", saspayId)
          .maybeSingle()
      : { data: null };

    // Checkout hébergé : l'id de transaction SasPay n'était pas connu à la
    // création de la session. On le retrouve en interrogeant les sessions
    // checkout PENDING récentes (session.transaction === id du webhook).
    if (!transaction && saspayId) {
      const saspayKey = Deno.env.get("SASPAY_SECRET_KEY");
      if (saspayKey) {
        const veille = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const { data: enAttente } = await supabaseAdmin
          .from("payment_transactions")
          .select("id, user_id, status, checkout_session_id")
          .eq("status", "pending")
          .not("checkout_session_id", "is", null)
          .gte("created_at", veille)
          .limit(20);

        for (const candidat of enAttente ?? []) {
          try {
            const r = await fetch(
              `https://api.saspay.me/api/v1/checkout-sessions/${candidat.checkout_session_id}/`,
              { headers: { Authorization: `Bearer ${saspayKey}` } }
            );
            // SasPay enveloppe la réponse : { success, data: {...} }
            const corps = await r.json().catch(() => null);
            const session = corps?.data ?? corps;
            if (session?.transaction && session.transaction === saspayId) {
              // Lien établi : on mémorise l'id de transaction SasPay.
              await supabaseAdmin
                .from("payment_transactions")
                .update({ saspay_transaction_id: saspayId, updated_at: new Date().toISOString() })
                .eq("id", candidat.id);
              transaction = { id: candidat.id, user_id: candidat.user_id, status: candidat.status };
              break;
            }
          } catch {
            // Session illisible : on tente la suivante.
          }
        }
      }
    }

    if (!transaction) return new Response("transaction inconnue", { status: 200 });

    // Idempotence : un webhook déjà traité ne ré-active pas l'abonnement.
    if (transaction.status !== "pending") return new Response("déjà traité", { status: 200 });

    if (evenement === "transaction.success") {
      await activerAbonnement(supabaseAdmin, {
        transactionId: transaction.id,
        userId: transaction.user_id,
        // Doc SasPay : le numéro débité est dans `msisdn` (pas customer.phone).
        phone: donnees.msisdn ?? donnees.customer?.phone ?? null,
        network: donnees.network ?? null,
        payload,
      });
    } else if (evenement === "transaction.failed" || evenement === "transaction.cancelled") {
      await supabaseAdmin
        .from("payment_transactions")
        .update({
          status: evenement === "transaction.failed" ? "failed" : "cancelled",
          raw_webhook_payload: payload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", transaction.id);
    }

    // 5) Toujours 200, rapidement (timeout SasPay ~15 s).
    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response(`erreur: ${e}`, { status: 500 });
  }
});
