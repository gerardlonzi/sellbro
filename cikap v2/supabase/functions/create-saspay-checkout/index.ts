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
  CM: "XAF", CG: "XAF", GA: "XAF", CF: "XAF", TD: "XAF", GQ: "XAF",
  BF: "XOF", BJ: "XOF", CI: "XOF", ML: "XOF", NE: "XOF", SN: "XOF", TG: "XOF", GW: "XOF",
  CD: "CDF", 
  GH: "GHS",
  GN: "GNF", 
  KE: "KES", 
  MW: "MWK", 
  NG: "NGN",
  RW: "RWF", 
  TZ: "TZS", 
  UG: "UGX", 
  ZM: "ZMW",
  SO: "SOS", // Somalie
  ET: "ETB", 
  SL: "SLE", 
  MA: "MAD", 
  DZ: "DZD", 
  TN: "TND",
  EG: "EGP", ZA: "ZAR", AO: "AOA", BI: "BIF", CV: "CVE",
  KM: "KMF", DJ: "DJF", ER: "ERN", SZ: "SZL", GM: "GMD",
  LS: "LSL", LR: "LRD", LY: "LYD", MR: "MRO", MU: "MUR",
  MZ: "MZN", NA: "NAD", SC: "SCR", SDG: "SDG", ST: "STN",
  ZW: "ZWD",

  // Amériques
  US: "USD", CA: "CAD", BR: "BRL", MX: "MXN", AR: "ARS",
  CL: "CLP", CO: "COP", PE: "PEN", VE: "VES", UY: "UYU",
  PY: "PYG", BO: "BOB", EC: "USD", CR: "CRC", CU: "CUP",
  DO: "DOP", GT: "GTQ", HT: "HTG", HN: "HNL", NI: "NIO",
  PA: "PAB", SV: "USD", BS: "BSD", BB: "BBD", BZD: "BZD",
  DM: "XCD", GD: "XCD", GY: "GYD", JM: "JMD", KN: "XCD",
  LC: "XCD", VC: "XCD", SR: "SRD", TT: "TTD",

  // Europe
  FR: "EUR", DE: "EUR", ES: "EUR", IT: "EUR", PT: "EUR",
  BE: "EUR", NL: "EUR", AT: "EUR", FI: "EUR", IE: "EUR",
  GR: "EUR", CY: "EUR", EE: "EUR", LV: "EUR", LT: "EUR",
  LU: "EUR", MT: "EUR", SK: "EUR", SI: "EUR", HR: "EUR",
  GB: "GBP", CH: "CHF", NO: "NOK", DK: "DKK", SE: "SEK",
  PL: "PLN", RO: "RON", CZ: "CZK", HU: "HUF", UA: "UAH",
  RU: "RUB", BY: "BYN", MD: "MDL", BA: "BAM", RS: "RSD",
  ME: "EUR", AL: "ALL", MK: "MKD", BG: "BGN", IS: "ISK",
  MC: "EUR", SM: "EUR", VA: "EUR", AD: "EUR", LI: "CHF",

  // Asie & Moyen-Orient
  CN: "CNY", IN: "INR", JP: "JPY", KR: "KRW", ID: "IDR",
  PK: "PKR", BD: "BDT", PH: "PHP", VN: "VND", IR: "IRR",
  TR: "TRY", TH: "THB", MM: "MMK", IQ: "IQD", SA: "SAR",
  UZ: "UZS", MY: "MYR", YE: "YER", NPR: "NPR", KP: "KPW",
  LK: "LKR", KZ: "KZT", SY: "SYP", KH: "KHR", JO: "JOD",
  AZ: "AZN", AE: "AED", TJ: "TJS", IL: "ILS", LA: "LAK",
  LB: "LBP", KG: "KGS", TMT: "TMT", SG: "SGD", PS: "ILS",
  KW: "KWD", OM: "OMR", QA: "QAR", BH: "BHD", TL: "USD",
  MN: "MNT", AM: "AMD", GE: "GEL", BND: "BND", BTN: "BTN",
  MVR: "MVR",

  // Océanie
  AU: "AUD", NZ: "NZD", PG: "PGK", FJ: "FJD", SB: "SBD",
  VU: "VUV", WS: "WST", KI: "AUD", FM: "USD", MH: "USD",
  NR: "AUD", PW: "USD", TO: "TOP", TV: "AUD",
  
  // Cas spéciaux UI (Somalie/Crypto)
  XC: "USD",
  XY: "USD"};

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

    // Plan demandé (starter | premium) — validé contre la liste blanche :
    // c'est la table `plans` qui fixe le prix, JAMAIS le client.
    const planId = body?.plan_id === "starter" ? "starter" : "premium";

    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 3) Prix (table plans, source de vérité) ET profil client : requêtes
    //    indépendantes lancées EN PARALLÈLE (un round-trip de moins).
    const [{ data: plan }, { data: profil }] = await Promise.all([
      supabaseAdmin.from("plans").select("prix, prix_par_devise").eq("id", planId).single(),
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
        plan_id: planId, // le webhook activera CE plan (starter ou premium)
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
        description: planId === "starter" ? "Abonnement Cikap Starter" : "Abonnement Cikap Premium",
        // Les frais sont AJOUTÉS au montant affiché : c'est le payeur qui les
        // prend en charge (2000 F + frais débités), tu reçois le prix exact.
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

    // On renvoie le plan et le montant RÉELLEMENT facturés : l'app vérifie qu'ils
    // correspondent au plan choisi avant d'ouvrir la page de paiement.
    return json({
      transaction_id: transaction.id,
      checkout_url: session.checkout_url,
      plan_id: planId,
      amount: Number(montant),
      currency: devise,
    });
  } catch (e) {
    return json({ error: `erreur interne: ${e}` }, 500);
  }
});
