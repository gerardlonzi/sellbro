// Edge Function : crée une session de paiement HÉBERGÉE chez le premier
// agrégateur disponible (table `payment_providers`, pilotée depuis la base).
//
// - L'app n'envoie que { country, plan_id } : le PRIX vient de la table `plans`
//   (converti avec les taux de app_config, comme dans l'app) — jamais du client.
// - Si un agrégateur échoue ou est désactivé, on essaie automatiquement le suivant.
// - Réponse : { transaction_id, checkout_url, plan_id, amount, currency, provider }
//   En cas d'erreur : { error, code } — `code` est traduit côté app (FR/EN).
//
// Déploiement : supabase functions deploy create-checkout
// Secrets : SASPAY_SECRET_KEY (et/ou FLUTTERWAVE_SECRET_KEY…) — jamais côté client.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS, DEVISE_PAR_PAYS, json } from "../_shared/pays.ts";
import { prixPourDevise } from "../_shared/prix.ts";
import { candidatsPaiement } from "../_shared/providers/index.ts";

// SasPay / Flutterwave exigent du https:// : cette fonction sert de pont vers le
// deep link cikap://premium/retour (ce n'est PAS une preuve de paiement).
const RETURN_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/checkout-retour`;

const fail = (code: string, status: number, detail?: string) => json({ error: detail ?? code, code }, status);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return fail("non_authentifie", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const clientUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: errAuth } = await clientUser.auth.getUser();
    if (errAuth || !user) return fail("session_invalide", 401);

    const body = await req.json().catch(() => ({}));
    const country: string = typeof body?.country === "string" ? body.country.toUpperCase() : "";
    // Devise : table intégrée pour les pays connus, sinon la devise envoyée par
    // l'app (pays ajoutés par vous, ex. FR/EUR). L'éligibilité réelle se décide
    // ensuite en base : `payment_providers.pays/devises` + taux dans app_config.
    const deviseDemandee: string = typeof body?.currency === "string" ? body.currency.toUpperCase() : "";
    const devise = DEVISE_PAR_PAYS[country] ?? (/^[A-Z]{3}$/.test(deviseDemandee) ? deviseDemandee : "");
    if (!country || !devise) return fail("pays_non_supporte", 400);
    const planId = body?.plan_id === "starter" ? "starter" : "premium";

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Prix, profil et fournisseurs disponibles : requêtes indépendantes en parallèle.
    const [prix, { data: profil }, candidats] = await Promise.all([
      prixPourDevise(admin, planId, devise),
      admin.from("profiles").select("nom_boutique, telephone").eq("id", user.id).maybeSingle(),
      candidatsPaiement(admin, country, devise),
    ]);
    if ("erreur" in prix) return fail(prix.erreur, 500);
    if (candidats.length === 0) return fail("aucun_fournisseur", 503);

    const montant = prix.montant;
    const nom = profil?.nom_boutique || user.user_metadata?.nom_complet || user.email?.split("@")[0] || "Client Cikap";
    const description = planId === "starter" ? "Abonnement Cikap Starter" : "Abonnement Cikap Premium";

    // Trace locale PENDING avant tout appel externe.
    const { data: tx, error: errInsert } = await admin
      .from("payment_transactions")
      .insert({
        user_id: user.id,
        idempotency_key: crypto.randomUUID(),
        amount: montant,
        currency: devise,
        network: "checkout",
        status: "pending",
        plan_id: planId,
        provider: candidats[0].fournisseur.id,
      })
      .select("id")
      .single();
    if (errInsert || !tx) {
      console.error("insert payment_transactions:", errInsert);
      return fail("transaction_impossible", 500);
    }

    // Basculement : on essaie chaque fournisseur actif dans l'ordre de priorité.
    const erreurs: string[] = [];
    for (const { fournisseur, cle } of candidats) {
      try {
        const session = await fournisseur.creerSession(admin, {
          transactionId: tx.id, montant, devise, country, description,
          email: user.email, nom, telephone: profil?.telephone ?? "", returnUrl: RETURN_URL,
        }, cle);
        await admin.from("payment_transactions").update({
          provider: fournisseur.id,
          checkout_session_id: session.sessionId,
          provider_reference: session.reference ?? null,
          updated_at: new Date().toISOString(),
        }).eq("id", tx.id);
        console.log(`checkout: tx=${tx.id} fournisseur=${fournisseur.id} plan=${planId} ${montant} ${devise}`);
        return json({
          transaction_id: tx.id, checkout_url: session.checkoutUrl,
          plan_id: planId, amount: montant, currency: devise, provider: fournisseur.id,
        });
      } catch (e) {
        console.error(`fournisseur ${fournisseur.id} en échec:`, String(e));
        erreurs.push(`${fournisseur.id}: ${String(e).slice(0, 300)}`);
      }
    }

    await admin.from("payment_transactions")
      .update({ status: "failed", raw_webhook_payload: { erreurs }, updated_at: new Date().toISOString() })
      .eq("id", tx.id);
    return fail("fournisseur_indisponible", 502, erreurs.join(" | "));
  } catch (e) {
    console.error("create-checkout:", e);
    return fail("erreur_interne", 500, String(e));
  }
});
