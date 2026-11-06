// Adaptateur Flutterwave (Standard / hosted payment). Écrit d'après la doc
// publique (POST /v3/payments, GET /v3/transactions/verify_by_reference) :
// À TESTER avec tes clés avant d'activer la ligne dans `payment_providers`.
import { FournisseurPaiement } from "./types.ts";

const BASE = "https://api.flutterwave.com/v3";

export const flutterwave: FournisseurPaiement = {
  id: "flutterwave",
  secretEnv: "FLUTTERWAVE_SECRET_KEY",

  async creerSession(_admin, p, cle) {
    const reference = `cikap-${p.transactionId}`;
    const reponse = await fetch(`${BASE}/payments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_ref: reference,
        amount: p.montant,
        currency: p.devise,
        redirect_url: p.returnUrl,
        customer: { email: p.email ?? "client@cikap.app", name: p.nom, phonenumber: p.telephone || undefined },
        customizations: { title: "Cikap", description: p.description },
        meta: { transaction_id: p.transactionId },
      }),
    });
    const corps = await reponse.json().catch(() => null);
    const lien = corps?.data?.link;
    if (!reponse.ok || corps?.status !== "success" || !lien) {
      throw new Error(`Flutterwave a refusé (${reponse.status}) ${JSON.stringify(corps)}`);
    }
    return { checkoutUrl: lien, sessionId: reference, reference };
  },

  async verifier(_admin, tx, cle) {
    const reference = tx.provider_reference ?? `cikap-${tx.id}`;
    const r = await fetch(`${BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${cle}` },
    });
    const corps = await r.json().catch(() => null);
    if (!r.ok || !corps?.data) return { statut: "pending" };
    const d = corps.data;
    const s = String(d.status ?? "").toLowerCase();
    if (s === "successful") {
      // Garde-fou : le montant ET la devise payés doivent couvrir ce qu'on a facturé.
      if (tx.amount != null && Number(d.amount) < Number(tx.amount)) return { statut: "failed", payload: d };
      if (tx.currency && d.currency && String(d.currency).toUpperCase() !== String(tx.currency).toUpperCase()) return { statut: "failed", payload: d };
      return { statut: "success", payload: d, network: d.payment_type ?? "flutterwave", telephone: d.customer?.phone_number ?? null };
    }
    if (s === "failed") return { statut: "failed", payload: d };
    if (s === "cancelled") return { statut: "cancelled", payload: d };
    return { statut: "pending" };
  },
};
