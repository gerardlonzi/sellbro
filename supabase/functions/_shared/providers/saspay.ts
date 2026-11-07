import { FournisseurPaiement } from "./types.ts";

const BASE = "https://api.saspay.me/api/v1";

export const saspay: FournisseurPaiement = {
  id: "saspay",
  secretEnv: "SASPAY_SECRET_KEY",

  async creerSession(_admin, p, cle) {
    const reponse = await fetch(`${BASE}/checkout-sessions/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(p.montant).toFixed(2),
        currency: p.devise,
        country: p.country,
        description: p.description,
        customer_email: p.email,
        customer_name: p.nom,
        customer_phone: p.telephone,
        return_url: p.returnUrl,
        metadata: { transaction_id: p.transactionId },
      }),
    });
    const corps = await reponse.json().catch(() => null);
    const session = corps?.data ?? corps;
    if (!reponse.ok || !session?.checkout_url) {
      throw new Error(`SasPay a refusé (${reponse.status}) ${JSON.stringify(corps)}`);
    }
    return { checkoutUrl: session.checkout_url, sessionId: String(session.id) };
  },

  async verifier(admin, tx, cle) {
    const entetes = { Authorization: `Bearer ${cle}` };

    // Checkout hébergé : la session porte le statut et, une fois payée, l'id de
    // la transaction SasPay.
    if (!tx.saspay_transaction_id && tx.checkout_session_id) {
      const r = await fetch(`${BASE}/checkout-sessions/${tx.checkout_session_id}/`, { headers: entetes });
      const corps = await r.json().catch(() => null);
      const session = corps?.data ?? corps;
      if (!r.ok || !session) return { statut: "pending" };
      if (session.transaction) {
        await admin.from("payment_transactions")
          .update({ saspay_transaction_id: session.transaction, updated_at: new Date().toISOString() })
          .eq("id", tx.id);
      }
      const s = String(session.status ?? "").toUpperCase();
      if (s === "SUCCESS" || s === "PAID") return { statut: "success", payload: session, network: "checkout", telephone: session.customer_phone ?? null };
      if (s === "CANCELLED") return { statut: "cancelled", payload: session };
      if (s === "FAILED" || s === "EXPIRED") return { statut: "failed", payload: session };
      return { statut: "pending" };
    }

    if (!tx.saspay_transaction_id) return { statut: "pending" };
    const r = await fetch(`${BASE}/payments/${tx.saspay_transaction_id}/verify/`, { headers: entetes });
    const corps = await r.json().catch(() => null);
    const res = corps?.data ?? corps;
    if (!r.ok) return { statut: "pending" };
    const s = String(res?.status ?? "").toUpperCase();
    if (s === "SUCCESS" || s === "SUCCESSFUL" || s === "COMPLETED") {
      return { statut: "success", payload: res, network: res?.network ?? tx.network, telephone: res?.customer?.phone ?? null };
    }
    if (s === "FAILED") return { statut: "failed", payload: res };
    if (s === "CANCELLED") return { statut: "cancelled", payload: res };
    return { statut: "pending" };
  },
};
