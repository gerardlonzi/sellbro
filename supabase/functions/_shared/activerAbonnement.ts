// Logique partagée d'activation d'abonnement après paiement confirmé.
// Utilisée par saspay-webhook (source de vérité) ET verify-payment (secours).
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Marque la transaction comme réussie et active l'abonnement Premium de
// l'utilisateur : +1 mois à partir de maintenant (ou prolongation si un
// abonnement encore actif existe — on paie toujours la période entière).
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

  // 1) Transaction → success (avec payload brut pour traçabilité).
  await supabaseAdmin
    .from("payment_transactions")
    .update({
      status: "success",
      raw_webhook_payload: payload ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transactionId);

  // 2) Abonnement : prolonge la date d'expiration si elle est encore future.
  const { data: abo } = await supabaseAdmin
    .from("abonnements")
    .select("id, date_expiration")
    .eq("user_id", userId)
    .order("date_expiration", { ascending: false })
    .limit(1)
    .maybeSingle();

  const maintenant = new Date();
  const base =
    abo?.date_expiration && new Date(abo.date_expiration) > maintenant
      ? new Date(abo.date_expiration)
      : maintenant;
  const expiration = new Date(base);
  expiration.setMonth(expiration.getMonth() + 1);

  if (abo) {
    await supabaseAdmin
      .from("abonnements")
      .update({
        statut: "actif",
        date_expiration: expiration.toISOString(),
        payment_phone: phone,
        payment_network: network,
      })
      .eq("id", abo.id);
  } else {
    await supabaseAdmin.from("abonnements").insert({
      user_id: userId,
      statut: "actif",
      date_debut: maintenant.toISOString(),
      date_expiration: expiration.toISOString(),
      payment_phone: phone,
      payment_network: network,
    });
  }

  // 3) Plan → premium (lu par planStore.rafraichirPlan côté app).
  await supabaseAdmin
    .from("plan_utilisateur")
    .upsert({ user_id: userId, plan_id: "premium" }, { onConflict: "user_id" });
}
