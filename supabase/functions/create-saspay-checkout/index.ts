// Edge Function : crée une session de CHECKOUT HÉBERGÉ SasPay.
//
// C'est SasPay qui affiche la page de paiement (choix du réseau, numéro,
// confirmation) — l'app ne collecte AUCUNE donnée de paiement. L'app reçoit
// juste checkout_url et l'ouvre dans le navigateur.
//
// Flux : app (JWT) → cette fonction → POST /checkout-sessions/ → checkout_url
//        → paiement sur la page SasPay → webhook saspay-webhook → Pro activé.
//
// Déploiement : supabase functions deploy create-saspay-checkout
// Secret requis : SASPAY_SECRET_KEY (jamais côté client)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SASPAY_CHECKOUT_URL = "https://api.saspay.me/api/v1/checkout-sessions/";

// Après paiement réussi, la page hébergée redirige vers cette URL. SasPay
// exige du https:// : la fonction checkout-retour sert de pont et redirige
// (302) vers le deep link cikap://premium/retour de l'app. Ce n'est PAS une
// preuve de paiement : seul le webhook confirme.
const RETURN_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/checkout-retour`;

// Pays supportés par SasPay → devise de facturation. Miroir de
// lib/currency/taux.ts (DEVISES_PAR_PAYS) — à garder synchronisé.
const DEVISE_PAR_PAYS: Record<string, string> = {
  BF: "XOF", BJ: "XOF", CD: "CDF", CI: "XOF", CM: "XAF", GH: "GHS",
  GN: "GNF", KE: "KES", ML: "XOF", MW: "MWK", NE: "XOF", NG: "NGN",
  RW: "RWF", SN: "XOF", TG: "XOF", TZ: "TZS", UG: "UGX", ZM: "ZMW",
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
    const saspayKey = Deno.env.get("SASPAY_SECRET_KEY");
    if (!saspayKey) return json({ error: "SasPay non configuré" }, 500);

    const clientUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: errAuth } = await clientUser.auth.getUser();
    if (errAuth || !user) return json({ error: "session invalide" }, 401);

    // 2) Pays du client (présélection sur la page SasPay) — validé contre la
    //    liste supportée. Le choix du réseau se fait SUR la page SasPay.
    const body = await req.json().catch(() => ({}));
    const country: string = typeof body?.country === "string" ? body.country.toUpperCase() : "";
    const devise = DEVISE_PAR_PAYS[country];
    if (!devise) return json({ error: "pays non supporté" }, 400);

    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 3) Prix (table plans, source de vérité) ET profil client : requêtes
    //    indépendantes lancées EN PARALLÈLE (un round-trip de moins).
    const [{ data: plan }, { data: profil }] = await Promise.all([
      supabaseAdmin.from("plans").select("prix, prix_par_devise").eq("id", "premium").single(),
      supabaseAdmin.from("profiles").select("nom_boutique, telephone").eq("id", user.id).maybeSingle(),
    ]);
    if (!plan) return json({ error: "plan introuvable" }, 500);

    const montant = devise === "XAF" ? plan.prix : plan.prix_par_devise?.[devise];
    if (!montant || !Number.isFinite(Number(montant))) {
      return json({ error: `prix non configuré pour la devise ${devise}` }, 500);
    }
    const customerName =
      profil?.nom_boutique || user.user_metadata?.nom_complet || user.email?.split("@")[0] || "Client Cikap";

    // 5) Trace locale PENDING AVANT l'appel SasPay (l'id est passé dans les
    //    metadata pour retrouver la transaction au retour du webhook).
    const { data: transaction, error: errInsert } = await supabaseAdmin
      .from("payment_transactions")
      .insert({
        user_id: user.id,
        idempotency_key: crypto.randomUUID(),
        amount: montant,
        currency: devise,
        network: "checkout", // réseau choisi par le client sur la page SasPay
        status: "pending",
      })
      .select("id")
      .single();
    if (errInsert || !transaction) return json({ error: "création transaction impossible" }, 500);

    // 6) Création de la session de checkout hébergée.
    //    NB : Idempotency-Key n'est PAS supporté sur cet endpoint (doc SasPay)
    //    — sans conséquence : une session non payée ne débite rien.
    const reponse = await fetch(SASPAY_CHECKOUT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${saspayKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Number(montant).toFixed(2),
        currency: devise,
        country,
        description: "Abonnement Cikap Pro",
        // Les frais sont DÉDUITS du montant reçu : le client paie EXACTEMENT
        // le prix affiché (2000 F = 2000 F débités).
        fee_charge_mode: "DEDUCTED",
        customer_email: user.email,
        customer_name: customerName,
        customer_phone: profil?.telephone ?? "",
        return_url: RETURN_URL,
        metadata: { transaction_id: transaction.id, user_id: user.id },
      }),
    });

    // SasPay enveloppe la réponse : { success, data: { id, checkout_url, ... } }
    const corpsSasPay = await reponse.json().catch(() => null);
    const session = corpsSasPay?.data ?? corpsSasPay;

    if (!reponse.ok || !session?.checkout_url) {
      console.error(`SasPay a refusé: status=${reponse.status} réponse=${JSON.stringify(corpsSasPay)}`);
      await supabaseAdmin
        .from("payment_transactions")
        .update({ status: "failed", raw_webhook_payload: corpsSasPay, updated_at: new Date().toISOString() })
        .eq("id", transaction.id);
      return json({ error: "checkout non créé" }, 502);
    }

    // 7) On mémorise l'id de session : le webhook transaction.* ne connaît que
    //    l'id de TRANSACTION SasPay — la session permet de faire le lien.
    await supabaseAdmin
      .from("payment_transactions")
      .update({ checkout_session_id: session.id, updated_at: new Date().toISOString() })
      .eq("id", transaction.id);

    console.log(`checkout créé: transaction=${transaction.id} session=${session.id} pays=${country} devise=${devise} montant=${montant}`);

    return json({ transaction_id: transaction.id, checkout_url: session.checkout_url });
  } catch (e) {
    return json({ error: `erreur interne: ${e}` }, 500);
  }
});
