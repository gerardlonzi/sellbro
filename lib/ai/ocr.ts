import { supabase } from "../supabase/client";

export async function scannerFacture(imageUri: string): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const reponseImage = await fetch(imageUri);
  const blobImage = await reponseImage.blob();

  const { data, error } = await supabase.functions.invoke("scanner-facture", {
    body: blobImage,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) {
    console.warn("Scan impossible :", error.message);
    return null;
  }

  return data?.texte ?? null;
}