import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "../supabase/client";
import { avecTimeout } from "@/lib/timeout";
import { classerErreur } from "@/lib/scanner/providers/OpenAIEdgeProvider";

// Résultat explicite : l'écran peut dire la VRAIE cause (plan, quota, connexion,
// serveur, ou simplement « rien entendu ») au lieu d'un message générique.
export type ResultatTranscription =
  | { ok: true; texte: string }
  | { ok: false; erreur: "quota" | "reserve" | "hors_ligne" | "serveur" | "session" | "silence" };

export async function transcrireAudio(audioUri: string, langue?: "fr" | "en"): Promise<ResultatTranscription> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, erreur: "hors_ligne" };

    // Envoi en base64 dans un JSON : l'envoi d'un Blob lu depuis un fichier local
    // est peu fiable sur React Native (corps vide côté serveur).
    const audioBase64 = await FileSystem.readAsStringAsync(audioUri, { encoding: FileSystem.EncodingType.Base64 });
    if (!audioBase64 || audioBase64.length < 50) return { ok: false, erreur: "silence" };

    const { data, error } = await avecTimeout(
      supabase.functions.invoke("transcrire-vocal", {
        body: { audioBase64, typeMime: "audio/m4a", langue },
        headers: { Authorization: `Bearer ${session.access_token}` },
      }),
      45000
    );

    if (error) return { ok: false, erreur: await classerErreur(error) };

    const texte = typeof data?.texte === "string" ? data.texte.trim() : "";
    // Transcription réussie mais vide : le micro n'a rien capté (vrai silence).
    if (!texte) return { ok: false, erreur: "silence" };
    return { ok: true, texte };
  } catch (e: any) {
    console.warn("Transcription impossible :", e?.message ?? e);
    return { ok: false, erreur: "hors_ligne" };
  }
}
