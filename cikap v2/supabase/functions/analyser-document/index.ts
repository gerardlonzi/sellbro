// Edge Function : analyse d'une photo de facture/ticket/justificatif.
//
//   React Native → CETTE FONCTION → OpenAI (vision)
//
// La clé OPENAI_API_KEY ne quitte JAMAIS le serveur (§14). La fonction ne
// fait qu'EXTRAIRE des données structurées : elle n'écrit rien dans la base
// métier (§2) — la création des opérations est décidée côté app, après
// validation par l'utilisateur, via les services métier de Cikap.
//
// Déploiement : supabase functions deploy analyser-document
// Secret requis : supabase secrets set OPENAI_API_KEY=sk-...
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { planEffectifIA } from "../_shared/accesIA.ts";
import { diagnostiquerIA } from "../_shared/diagnostic.ts";
import { chaineIA, executerAvecBasculement } from "../_shared/ia/index.ts";

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

// Schéma STRICT renvoyé à l'app (miroir de lib/scanner/types.ts).
const SCHEMA = {
  type: "object",
  properties: {
    documentType: { type: "string", enum: ["sale", "purchase", "expense", "payment", "unknown"] },
    date: { type: ["string", "null"] },
    invoiceNumber: { type: ["string", "null"] },
    customerName: { type: ["string", "null"] },
    supplierName: { type: ["string", "null"] },
    currency: { type: ["string", "null"] },
    subtotal: { type: ["number", "null"] },
    tax: { type: ["number", "null"] },
    discount: { type: ["number", "null"] },
    total: { type: ["number", "null"] },
    paidAmount: { type: ["number", "null"] },
    remainingAmount: { type: ["number", "null"] },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rawName: { type: "string" },
          quantity: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          unitPrice: { type: ["number", "null"] },
          totalPrice: { type: ["number", "null"] },
          sku: { type: ["string", "null"] },
          barcode: { type: ["string", "null"] },
        },
        required: ["rawName"],
      },
    },
    expenses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rawDescription: { type: "string" },
          category: { type: ["string", "null"] },
          amount: { type: ["number", "null"] },
        },
        required: ["rawDescription"],
      },
    },
    notes: { type: ["string", "null"] },
    // Qualité de la photo, jugée par le modèle : l'app n'affiche « floue » ou
    // « sombre » QUE si c'est réellement le cas (jamais pour une panne serveur).
    imageIssue: { type: "string", enum: ["none", "blurry", "dark", "cropped", "not_a_document"] },
  },
  required: ["documentType", "items", "expenses", "imageIssue"],
};

const PROMPT_SYSTEME = `Tu analyses des photos de documents commerciaux (factures, tickets, reçus, justificatifs) pour une application de gestion de petits commerçants africains.

Ta SEULE mission : extraire des données structurées. Tu ne décides d'aucune opération comptable.

Règles de classification (documentType) :
- "sale" : facture/reçu émis PAR le commerçant à un client.
- "purchase" : facture d'un fournisseur (le commerçant ACHÈTE des marchandises).
- "expense" : facture de charge (électricité, eau, transport, loyer…).
- "payment" : reçu de paiement / remboursement de dette.
- "unknown" : document illisible ou incertain.

Règles d'extraction :
- Recopie les noms de produits EXACTEMENT comme écrits (rawName), même abrégés ou fautifs (« RUI », « DINOR 5L ») : le matching est fait ensuite par l'application, ne « corrige » jamais un nom.
- Montants en nombres, sans symbole ni séparateur de milliers.
- quantity : quantité de la ligne (pas la contenance du produit).
- unit : unité telle qu'écrite (kg, sac, L, sachet…).
- Si le document liste des produits ET une charge (ex: transport), mets la charge dans expenses.
- Tout ce qui est illisible → null, jamais de valeur inventée.
- imageIssue : "none" si la photo est exploitable ; "blurry" SEULEMENT si le texte est réellement flou ; "dark" si trop sombre/surexposée ; "cropped" si le document est coupé ; "not_a_document" si l'image n'est pas un document commercial. En cas de doute, "none".

Réponds UNIQUEMENT par un objet JSON (sans texte autour, sans balises) de la forme :
{"documentType":"sale|purchase|expense|payment|unknown","date":null,"invoiceNumber":null,"customerName":null,"supplierName":null,"currency":null,"subtotal":null,"tax":null,"discount":null,"total":null,"paidAmount":null,"remainingAmount":null,"items":[{"rawName":"","quantity":null,"unit":null,"unitPrice":null,"totalPrice":null,"sku":null,"barcode":null}],"expenses":[{"rawDescription":"","category":null,"amount":null}],"notes":null,"imageIssue":"none|blurry|dark|cropped|not_a_document"}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // 1) Authentification : JWT obligatoire.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "non_authentifie" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return json({ error: "non_authentifie" }, 401);

    // 1b) Gating plan : l'IA est réservée au Premium (et à l'essai actif).
    //     Sans ce contrôle, n'importe quel compte gratuit pouvait consommer
    //     des appels OpenAI payants. Quotas lus depuis la table `plans`.
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Mode diagnostic (écran Réglages → Diagnostic) : liste les prérequis
    // manquants au lieu d'un « erreur serveur » opaque.
    const corpsBrut = await req.json().catch(() => null);
    if (corpsBrut?.diagnostic === true) {
      return json({ diagnostic: await diagnostiquerIA(admin, user.id) });
    }

    const { planId, quotaScan } = await planEffectifIA(admin, user.id);
    // Plan sans IA (Gratuit hors essai, Starter) : message distinct d'un quota
    // épuisé — l'app invite à passer à Premium au lieu de parler de quota.
    if (quotaScan <= 0) return json({ error: "reserve_premium", plan: planId }, 403);

    // 2) Entrée validée AVANT de consommer le quota (une requête invalide ne
    //    doit rien coûter à l'utilisateur).
    const corps = corpsBrut;
    const imageBase64 = corps?.imageBase64;
    const typeMime = typeof corps?.typeMime === "string" ? corps.typeMime : "image/jpeg";
    if (typeof imageBase64 !== "string" || imageBase64.length < 100) {
      return json({ error: "image_manquante" }, 400);
    }
    // Garde-fou coût/sécurité : on refuse les images absurdement grosses.
    if (imageBase64.length > 6 * 1024 * 1024) {
      return json({ error: "image_trop_volumineuse" }, 413);
    }
    // Chaîne de fournisseurs IA (table ia_providers) : basculement automatique.
    const chaine = await chaineIA(admin, "vision");
    if (chaine.length === 0) {
      console.error("Aucun fournisseur IA vision utilisable : poser OPENAI_API_KEY / GEMINI_API_KEY / XAI_API_KEY et vérifier ia_providers");
      return json({ error: "service_non_configure" }, 503);
    }

    const debutMois = new Date();
    debutMois.setDate(1);
    debutMois.setHours(0, 0, 0, 0);
    // Les analyses ÉCHOUÉES (panne OpenAI, etc.) ne comptent jamais dans le quota.
    const { count: scansUtilises } = await admin
      .from("document_scans")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .neq("status", "echouee")
      .gte("created_at", debutMois.toISOString());
    if ((scansUtilises ?? 0) >= quotaScan) return json({ error: "quota_epuise" }, 403);

    // Réserve le quota pour cette analyse (la validation met la ligne à jour).
    const { data: reservation, error: errReservation } = await admin
      .from("document_scans")
      .insert({ user_id: user.id, document_type: "unknown", status: "analysee" })
      .select("id")
      .single();
    if (errReservation || !reservation?.id) {
      // Cause la plus fréquente : profil absent (clé étrangère) ou migration
      // 20261004 non appliquée — visible dans le diagnostic et les logs.
      console.error("réservation scan impossible", JSON.stringify(errReservation));
      return json({ error: "reservation_impossible" }, 500);
    }
    const scanId = reservation.id;

    // 3) Candidats produits (présélection LOCALE côté app — §20 : on
    //    n'envoie jamais toute la base, seulement les meilleurs candidats).
    const candidats: { id: string; nom: string }[] = Array.isArray(corps?.contexte?.candidatsProduits)
      ? corps.contexte.candidatsProduits.slice(0, 30)
      : [];
    const noteCandidats = candidats.length > 0
      ? `\n\nCandidats produits du catalogue du commerçant (pour t'aider à lire les noms, PAS pour les renommer) :\n${candidats.map((c) => `- ${c.nom}`).join("\n")}`
      : "";

    // 4) Analyse avec basculement : OpenAI → Gemini → Grok (ordre de la base).
    //    Une réponse illisible (JSON invalide) compte comme un échec → suivant.
    const resultat = await executerAvecBasculement(admin, user.id, "vision", chaine, async (c) => {
      const texte = await c.fournisseur.analyserImage!({
        imageBase64,
        typeMime,
        systeme: PROMPT_SYSTEME + noteCandidats,
        consigne: "Analyse ce document commercial et renvoie le JSON structuré.",
        schema: SCHEMA,
      }, c.cle, c.modele, c.delaiMs);
      // Certains modèles entourent le JSON de ```json … ``` : on nettoie.
      const nettoye = texte.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const objet = JSON.parse(nettoye);
      if (typeof objet !== "object" || objet === null) throw new Error("JSON non objet");
      return objet;
    });

    if (!resultat.ok) {
      await admin.from("document_scans").update({ status: "echouee" }).eq("id", scanId);
      return json({ error: "analyse_indisponible" }, 502);
    }
    const document = resultat.valeur;

    await admin.from("document_scans").update({
      document_type: document?.documentType ?? "unknown",
      raw_extraction: document,
      status: "analysee",
    }).eq("id", scanId);
    // Traçabilité du fournisseur utilisé (colonne ajoutée par la migration 20261023).
    admin.from("document_scans").update({ fournisseur_ia: resultat.fournisseur }).eq("id", scanId).then(() => {}, () => {});

    return json({ document, scanId, fournisseur: resultat.fournisseur });
  } catch (e) {
    console.error("analyser-document", e);
    return json({ error: "erreur_interne" }, 500);
  }
});
