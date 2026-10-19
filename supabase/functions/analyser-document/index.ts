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

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODELE = "gpt-4o-mini"; // vision + JSON, bon rapport coût/précision

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
  },
  required: ["documentType", "items", "expenses"],
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
- Tout ce qui est illisible → null, jamais de valeur inventée.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // 1) Authentification : JWT obligatoire.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "non authentifié" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return json({ error: "non authentifié" }, 401);

    // 1b) Gating plan : l'IA est réservée au Premium (et à l'essai actif).
    //     Sans ce contrôle, n'importe quel compte gratuit pouvait consommer
    //     des appels OpenAI payants. Quotas lus depuis la table `plans`.
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { quotaScan } = await planEffectifIA(admin, user.id);
    const debutMois = new Date();
    debutMois.setDate(1);
    const { count: scansUtilises } = await admin
      .from("document_scans")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", debutMois.toISOString());
    if (quotaScan <= 0 || (scansUtilises ?? 0) >= quotaScan) {
      return json({ error: "quota_epuise" }, 403);
    }

    // Consomme le quota DÈS l'analyse (pas seulement à la validation) :
    // sinon un utilisateur pouvait appeler OpenAI en boucle sans jamais
    // confirmer. Une ligne « analysee » est créée ; la validation la met
    // à jour (pas de 2e consommation).
    const { data: reservation, error: errReservation } = await admin
      .from("document_scans")
      .insert({ user_id: user.id, document_type: "unknown", status: "analysee" })
      .select("id")
      .single();
    if (errReservation || !reservation?.id) {
      return json({ error: "quota_epuise" }, 403);
    }
    const scanId = reservation.id;

    // 2) Entrée : image base64 + contexte (candidats produits locaux).
    const corps = await req.json();
    const imageBase64 = corps?.imageBase64;
    const typeMime = typeof corps?.typeMime === "string" ? corps.typeMime : "image/jpeg";
    if (typeof imageBase64 !== "string" || imageBase64.length < 100) {
      return json({ error: "image manquante" }, 400);
    }
    // Garde-fou coût/sécurité : on refuse les images absurdement grosses.
    if (imageBase64.length > 6 * 1024 * 1024) {
      return json({ error: "image trop volumineuse" }, 413);
    }

    // 3) Candidats produits (présélection LOCALE côté app — §20 : on
    //    n'envoie jamais toute la base, seulement les meilleurs candidats).
    const candidats: { id: string; nom: string }[] = Array.isArray(corps?.contexte?.candidatsProduits)
      ? corps.contexte.candidatsProduits.slice(0, 30)
      : [];
    const noteCandidats = candidats.length > 0
      ? `\n\nCandidats produits du catalogue du commerçant (pour t'aider à lire les noms, PAS pour les renommer) :\n${candidats.map((c) => `- ${c.nom}`).join("\n")}`
      : "";

    // 4) Appel OpenAI (vision + sortie JSON structurée).
    const cleOpenAI = Deno.env.get("OPENAI_API_KEY");
    if (!cleOpenAI) return json({ error: "service d'analyse non configuré" }, 503);

    const reponse = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${cleOpenAI}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELE,
        temperature: 0,
        response_format: { type: "json_schema", json_schema: { name: "document_commercial", schema: SCHEMA, strict: false } },
        messages: [
          { role: "system", content: PROMPT_SYSTEME + noteCandidats },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyse ce document commercial et renvoie le JSON structuré." },
              { type: "image_url", image_url: { url: `data:${typeMime};base64,${imageBase64}` } },
            ],
          },
        ],
      }),
    });

    if (!reponse.ok) {
      const detail = await reponse.text();
      console.error("OpenAI error", reponse.status, detail.slice(0, 500));
      await admin.from("document_scans").update({ status: "echouee" }).eq("id", scanId);
      return json({ error: "analyse indisponible" }, 502);
    }

    const resultat = await reponse.json();
    const contenu = resultat?.choices?.[0]?.message?.content;
    if (typeof contenu !== "string") {
      await admin.from("document_scans").update({ status: "echouee" }).eq("id", scanId);
      return json({ error: "réponse vide" }, 502);
    }

    let document;
    try {
      document = JSON.parse(contenu);
    } catch {
      await admin.from("document_scans").update({ status: "echouee" }).eq("id", scanId);
      return json({ error: "réponse illisible" }, 502);
    }

    await admin.from("document_scans").update({
      document_type: document?.documentType ?? "unknown",
      raw_extraction: document,
      status: "analysee",
    }).eq("id", scanId);

    return json({ document, scanId });
  } catch (e) {
    console.error("analyser-document", e);
    return json({ error: "erreur interne" }, 500);
  }
});
