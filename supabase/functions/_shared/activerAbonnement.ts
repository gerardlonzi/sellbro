// Logique partagée d'activation d'abonnement après paiement confirmé.
// Utilisée par saspay-webhook (source de vérité) ET verify-payment (secours).
//
// IMPORTANT : `plan_utilisateur` est une VUE calculée depuis `abonnements`
// (plan actif le plus récent, sinon 'gratuit') — on n'y écrit JAMAIS. Il
// suffit d'avoir un abonnement 'actif' non expiré pour que l'app voie le
// plan Premium (planStore.rafraichirPlan lit cette vue).
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Marque la transaction comme réussie et active l'abonnement Premium de
// l'utilisateur : +1 mois à partir de maintenant (ou prolongation si un
// abonnement encore actif existe — on paie toujours la période entière).
// Lève une erreur si une écriture échoue (le webhook doit renvoyer 500 pour
// que SasPay réessaie, plutôt qu'un faux succès silencieux).
export async function activerAbonnement(
  supabaseAdmin: SupabaseClient,
  params: {
    transactionId: string; // id interne payment_transactions
    userId: string;
    phone: string | null;
    network: string | null;
    payload?: unknown;
  }
): Promise<void> {
  const { transactionId, userId, phone, network, payload } = params;

  // 1) Transaction → success (avec payload brut pour traçabilité). On lit le
  //    montant au passage pour le snapshot dans l'abonnement.
  const { data: tx, error: errTx } = await supabaseAdmin
    .from("payment_transactions")
    .update({
      status: "success",
      raw_webhook_payload: payload ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transactionId)
    .select("amount")
    .single();
  if (errTx) throw new Error(`transaction non mise à jour: ${errTx.message}`);

  // 2) Abonnement : prolonge la date d'expiration si elle est encore future.
  const { data: abo, error: errLecture } = await supabaseAdmin
    .from("abonnements")
    .select("id, date_expiration")
    .eq("user_id", userId)
    .order("date_expiration", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (errLecture) throw new Error(`lecture abonnement: ${errLecture.message}`);

  const maintenant = new Date();
  const base =
    abo?.date_expiration && new Date(abo.date_expiration) > maintenant
      ? new Date(abo.date_expiration)
      : maintenant;
  const expiration = new Date(base);
  expiration.setMonth(expiration.getMonth() + 1);

  // Schéma réel : plan_id (not null), moyen_paiement, montant_paye,
  // reference_transaction — PAS payment_phone/payment_network.
  const champs = {
    statut: "actif",
    date_expiration: expiration.toISOString(),
    moyen_paiement: network ?? null,
    montant_paye: tx?.amount != null ? Number(tx.amount) : null,
    reference_transaction: transactionId,
  };

  if (abo) {
    const { error } = await supabaseAdmin.from("abonnements").update(champs).eq("id", abo.id);
    if (error) throw new Error(`abonnement non prolongé: ${error.message}`);
  } else {
    const { error } = await supabaseAdmin.from("abonnements").insert({
      user_id: userId,
      plan_id: "premium",
      date_debut: maintenant.toISOString(),
      ...champs,
    });
    if (error) throw new Error(`abonnement non créé: ${error.message}`);
  }

  console.log(`abonnement activé: user=${userId} transaction=${transactionId} expiration=${expiration.toISOString()}`);
}
