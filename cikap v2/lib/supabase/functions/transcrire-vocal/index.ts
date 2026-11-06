import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { planEffectifIA } from "../_shared/accesIA.ts";

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // 1. Identifier l'utilisateur depuis son token
  const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader?.replace("Bearer ", ""));
  if (!user) return new Response(JSON.stringify({ erreur: "Non authentifié" }), { status: 401 });

  // 2. Vérifier le plan et le quota AVANT de dépenser un appel OpenAI.
  //    Essai actif → quotas Premium ; gratuit/starter hors essai → 0 → refusé.
  const { quotaVocal } = await planEffectifIA(supabaseAdmin, user.id);

  const debutMois = new Date();
  debutMois.setDate(1);
  const { count: vocauxUtilises } = await supabaseAdmin
    .from("ventes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("source", "vocal")
    .gte("created_at", debutMois.toISOString());

  if ((vocauxUtilises ?? 0) >= quotaVocal) {
    return new Response(JSON.stringify({ erreur: "quota_epuise" }), { status: 403 });
  }

  // 3. Appel à OpenAI Whisper
  const audioBlob = await req.blob();
  const formData = new FormData();
  formData.append("file", audioBlob, "audio.m4a");
  formData.append("model", "gpt-4o-mini-transcribe");

  const reponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}` },
    body: formData,
  });

  if (!reponse.ok) {
    return new Response(JSON.stringify({ erreur: "echec_transcription" }), { status: 502 });
  }

  const resultat = await reponse.json();
  return new Response(JSON.stringify({ texte: resultat.text }), { headers: { "Content-Type": "application/json" } });
});