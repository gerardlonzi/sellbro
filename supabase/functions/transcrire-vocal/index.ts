// Edge Function : transcription vocale (OpenAI) d'une vente dictée.
//
// Entrée  : JSON { audioBase64, typeMime? } (envoi en base64, fiable sur React
//           Native) — l'ancien envoi d'un Blob brut reste accepté.
// Sortie  : { texte } ou { erreur: <code stable> } traduit côté app (FR/EN).
// Secret  : OPENAI_API_KEY.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { planEffectifIA } from "../_shared/accesIA.ts";
import { diagnostiquerIA } from "../_shared/diagnostic.ts";
import { chaineIA, executerAvecBasculement } from "../_shared/ia/index.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function reponseJson(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function base64VersOctets(b64: string): Uint8Array {
  const binaire = atob(b64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return octets;
}

const EXTENSIONS: Record<string, string> = {
  "audio/m4a": "m4a", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "m4a",
  "audio/mpeg": "mp3", "audio/wav": "wav", "audio/webm": "webm", "audio/ogg": "ogg", "audio/3gpp": "3gp",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: { user } } = await admin.auth.getUser(authHeader?.replace("Bearer ", "") ?? "");
    if (!user) return reponseJson({ erreur: "non_authentifie" }, 401);

    // Corps : JSON base64 (nouveau) ou audio brut (ancien).
    const typeContenu = req.headers.get("content-type") ?? "";
    let octets: Uint8Array;
    let typeMime = "audio/m4a";
    let langue: "fr" | "en" | undefined;
    if (typeContenu.includes("application/json")) {
      const corps = await req.json().catch(() => null);
      if (corps?.diagnostic === true) return reponseJson({ diagnostic: await diagnostiquerIA(admin, user.id) });
      if (typeof corps?.audioBase64 !== "string" || corps.audioBase64.length < 50) return reponseJson({ erreur: "audio_manquant" }, 400);
      if (corps.audioBase64.length > 8 * 1024 * 1024) return reponseJson({ erreur: "audio_trop_volumineux" }, 413);
      octets = base64VersOctets(corps.audioBase64);
      if (typeof corps.typeMime === "string") typeMime = corps.typeMime;
      if (corps.langue === "fr" || corps.langue === "en") langue = corps.langue;
    } else {
      octets = new Uint8Array(await req.arrayBuffer());
      if (typeContenu.startsWith("audio/")) typeMime = typeContenu.split(";")[0];
      if (octets.length < 50) return reponseJson({ erreur: "audio_manquant" }, 400);
    }

    const { planId, quotaVocal } = await planEffectifIA(admin, user.id);
    // Plan sans IA (Gratuit hors essai, Starter) : code distinct du quota épuisé.
    if (quotaVocal <= 0) return reponseJson({ erreur: "reserve_premium", plan: planId }, 403);

    const debutMois = new Date();
    debutMois.setDate(1);
    debutMois.setHours(0, 0, 0, 0);
    const { count: vocauxUtilises } = await admin
      .from("ventes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("source", "vocal")
      .gte("created_at", debutMois.toISOString());
    if ((vocauxUtilises ?? 0) >= quotaVocal) return reponseJson({ erreur: "quota_epuise" }, 403);

    const chaine = await chaineIA(admin, "audio");
    if (chaine.length === 0) {
      console.error("Aucun fournisseur IA audio utilisable : poser OPENAI_API_KEY / GEMINI_API_KEY et vérifier ia_providers");
      return reponseJson({ erreur: "service_non_configure" }, 503);
    }

    const extension = EXTENSIONS[typeMime] ?? "m4a";
    // Transcription avec basculement : OpenAI → Gemini (Grok n'a pas d'audio ici).
    const resultat = await executerAvecBasculement(admin, user.id, "audio", chaine, (c) =>
      c.fournisseur.transcrire!({ octets, typeMime, extension, langue }, c.cle, c.modele, c.delaiMs)
    );
    if (!resultat.ok) return reponseJson({ erreur: "echec_transcription" }, 502);

    return reponseJson({ texte: resultat.valeur, fournisseur: resultat.fournisseur });
  } catch (e) {
    console.error("transcrire-vocal", e);
    return reponseJson({ erreur: "erreur_interne" }, 500);
  }
});
