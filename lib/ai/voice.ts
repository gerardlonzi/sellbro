import { supabase } from "../supabase/client";

export async function transcrireAudio(audioUri: string): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const reponseAudio = await fetch(audioUri);
  const blobAudio = await reponseAudio.blob();

  const { data, error } = await supabase.functions.invoke("transcrire-vocal", {
    body: blobAudio,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) {
    console.warn("Transcription impossible :", error.message);
    return null;
  }

  return data?.texte ?? null;
}