// Edge Function : déclenche un paiement Mobile Money SasPay (softpay).
//
// Déploiement : supabase functions deploy initiate-payment
// Secret requis : supabase secrets set SASPAY_SECRET_KEY=sk_test_...
//
// Le montant est lu depuis la table `plans` côté serveur — jamais depuis le
// client. L'Idempotency-Key (UUID généré ici) protège contre les doubles
// paiements en cas de retry réseau.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SASPAY_URL = "https://api.saspay.me/api/v1/payments/softpay/";

// Réseaux autorisés par pays + devise de facturation (SasPay ne convertit
// pas les montants Mobile Money : le prix doit être dans la devise du pays).
// Miroir de lib/paiement/reseaux.ts — à garder synchronisé avec la doc SasPay
// (https://docs.saspay.me/api-reference/payments/softpay). Les réseaux marqués
// « inactif » dans la doc (eu_mobile_cm, orange_gn, e_money_sn) sont exclus.
const PAYS: Record<string, { devise: string; reseaux: string[] }> = {
  BF: { devise: "XOF", reseaux: ["moov_bf", "orange_bf"] },
  BJ: { devise: "XOF", reseaux: ["celtiis_bj", "moov_bj", "mtn_bj"] },
  CD: { devise: "CDF", reseaux: ["airtel_cd", "orange_cd", "vodacom_cd"] },
  CI: { devise: "XOF", reseaux: ["moov_ci", "mtn_ci", "orange_ci", "wave_ci"] },
  CM: { devise: "XAF", reseaux: ["mtn_cm", "orange_cm"] },
  GH: { devise: "GHS", reseaux: ["mtn_gh", "tigo_gh", "vodafone_gh"] },
  GN: { devise: "GNF", reseaux: ["mtn_gn"] },
  KE: { devise: "KES", reseaux: ["mpesa_ke"] },
  ML: { devise: "XOF", reseaux: ["mobi_cash_ml", "moov_ml", "orange_ml"] },
  MW: { devise: "MWK", reseaux: ["airtel_mw", "tnm_mw"] },
  NE: { devise: "XOF", reseaux: ["airtel_ne"] },
  NG: { devise: "NGN", reseaux: ["airtel_ng", "mtn_ng"] },
  RW: { devise: "RWF", reseaux: ["airtel_rw", "mtn_rw"] },
  SN: { devise: "XOF", reseaux: ["freemoney_sn", "orange_sn", "wave_sn", "wizall_sn"] },
  TG: { devise: "XOF", reseaux: ["moov_tg", "togocel"] },
  TZ: { devise: "TZS", reseaux: ["airtel_tz", "halopesa_tz", "mpesa_tz", "tigo_tz"] },
  UG: { devise: "UGX", reseaux: ["airtel_ug", "mtn_ug"] },
  ZM: { devise: "ZMW", reseaux: ["airtel_zm", "mtn_zm", "zamtel_zm"] },
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // 1) Authentification : le JWT de l'utilisateur est obligatoire.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "non authentifié" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const saspayKey = Deno.env.get("SASPAY_SECRET_KEY");
    if (!saspayKey) return json({ error: "SasPay non configuré" }, 500);

    const clientUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: errAuth } = await clientUser.auth.getUser();
    if (errAuth || !user) return json({ error: "session invalide" }, 401);

    // 2) Entrée : numéro Mobile Money + réseau + pays (le numéro est saisi
    //    par l'utilisateur à chaque paiement — jamais imposé depuis le profil).
    const { phone, network, country } = await req.json();
    if (!phone || typeof phone !== "string") return json({ error: "numéro requis" }, 400);
    const configPays = PAYS[country];
    if (!configPays) return json({ error: "pays non supporté" }, 400);
    if (!configPays.reseaux.includes(network)) return json({ error: "réseau invalide" }, 400);

    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 3) Montant depuis la table plans (source de vérité serveur). Le prix
    //    de base est en XAF ; prix_par_devise (jsonb) peut définir un prix
    //    spécifique par devise pour les autres pays, ex. {"XOF": 2000, "GHS": 50}.
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("prix, prix_par_devise")
      .eq("id", "premium")
      .single();
    if (!plan) return json({ error: "plan introuvable" }, 500);

    const devise = configPays.devise;
    const montant =
      devise === "XAF" ? plan.prix : plan.prix_par_devise?.[devise];
    if (!montant) {
      return json({ error: `prix non configuré pour la devise ${devise}` }, 500);
    }

    // 4) Trace en base AVANT l'appel SasPay (statut pending).
    const idempotencyKey = crypto.randomUUID();
    const { data: transaction, error: errInsert } = await supabaseAdmin
      .from("payment_transactions")
      .insert({
        user_id: user.id,
        idempotency_key: idempotencyKey,
        amount: montant,
        currency: devise,
        network,
        status: "pending",
      })
      .select("id")
      .single();
    if (errInsert || !transaction) return json({ error: "création transaction impossible" }, 500);

    // Nom du client pour SasPay (first_name/last_name requis par l'API) :
    // on le découpe depuis le nom de boutique / les métadonnées du compte.
    let firstName = "Client";
    let lastName = "Cikap";
    try {
      const { data: profil } = await supabaseAdmin
        .from("profiles")
        .select("nom_boutique")
        .eq("id", user.id)
        .single();
      const source = profil?.nom_boutique || user.user_metadata?.nom_complet || user.email?.split("@")[0] || "";
      const morceaux = source.trim().split(/\s+/).filter(Boolean);
      if (morceaux.length > 0) firstName = morceaux[0];
      if (morceaux.length > 1) lastName = morceaux.slice(1).join(" ");
    } catch {
      // Valeurs par défaut suffisantes.
    }

    // 5) Appel SasPay softpay. Le montant est une string décimale ("2500.00").
    const reponse = await fetch(SASPAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${saspayKey}`,
        "Idempotency-Key": idempotencyKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Number(montant).toFixed(2),
        currency: devise,
        country,
        network,
        description: "Abonnement Cikap Pro",
        // Les frais sont AJOUTÉS au montant affiché : c'est le payeur qui les
        // prend en charge, tu reçois le prix exact.
        fee_charge_mode: "INCLUDED",
        customer: {
          email: user.email,
          first_name: firstName,
          last_name: lastName,
          phone: phone.trim(),
        },
      }),
    });

    // SasPay enveloppe la réponse : { success, data: {...}, code } — on
    // déballe `data` si présente.
    const corpsSasPay = await reponse.json().catch(() => null);
    const resultat = corpsSasPay?.data ?? corpsSasPay;

    if (!reponse.ok) {
      await supabaseAdmin
        .from("payment_transactions")
        .update({ status: "failed", raw_webhook_payload: corpsSasPay, updated_at: new Date().toISOString() })
        .eq("id", transaction.id);
      // On ne relaie PAS le message brut de SasPay au client (il peut contenir
      // des mentions trompeuses type « solde insuffisant », que nous ne pouvons
      // pas vérifier). Le client affiche un message générique traduit ; le code
      // SasPay (missing_method, no_route_available…) reste dispo pour le debug.
      return json({ error: "initiation impossible", code: corpsSasPay?.code ?? resultat?.code ?? null }, 502);
    }

    // 6) Succès de l'initiation (statut PENDING côté SasPay — la confirmation
    //    finale arrive uniquement via le webhook).
    await supabaseAdmin
      .from("payment_transactions")
      .update({ saspay_transaction_id: resultat?.id ?? null, updated_at: new Date().toISOString() })
      .eq("id", transaction.id);

    return json({
      transaction_id: transaction.id,
      idempotency_key: idempotencyKey,
      // Certains réseaux renvoient une page de confirmation à ouvrir — l'app
      // doit la présenter à l'utilisateur, sinon le paiement ne se fait pas.
      checkout_url: resultat?.checkout_url ?? null,
    });
  } catch (e) {
    return json({ error: `erreur interne: ${e}` }, 500);
  }
});
