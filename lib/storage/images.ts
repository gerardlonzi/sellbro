import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "@/lib/supabase/client";

// Bucket Supabase Storage (créé par schema.sql) : un seul bucket, un dossier
// par type d'image (« produits », « logos »), puis un sous-dossier par user_id
// (les policies RLS n'autorisent l'écriture que dans SON dossier).
export const BUCKET_IMAGES = "images-boutika";

// Une image « locale » n'existe que sur ce téléphone (file://, content://,
// data:) : elle doit être téléversée pour être visible sur les autres appareils.
export function estImageLocale(uri: string): boolean {
  return !uri.startsWith("http://") && !uri.startsWith("https://");
}

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// Décodage base64 → octets, sans dépendance (atob n'est pas garanti sous Hermes).
function base64VersOctets(base64: string): Uint8Array {
  const propre = base64.replace(/=+$/, "");
  const octets = new Uint8Array(Math.floor((propre.length * 3) / 4));
  let valeur = 0;
  let bits = 0;
  let index = 0;
  for (let i = 0; i < propre.length; i++) {
    valeur = (valeur << 6) | BASE64_CHARS.indexOf(propre[i]);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      octets[index++] = (valeur >> bits) & 0xff;
    }
  }
  return octets;
}

// Lit une image (fichier local ou data: URI) et renvoie octets + type MIME.
async function lireImage(uri: string): Promise<{ octets: Uint8Array; typeMime: string; extension: string } | null> {
  try {
    if (uri.startsWith("data:")) {
      const [entete, donnees] = uri.split(",", 2);
      const typeMime = entete.slice(5).split(";")[0] || "image/jpeg";
      return { octets: base64VersOctets(donnees), typeMime, extension: typeMime.includes("png") ? "png" : "jpg" };
    }
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const ext = uri.split("?")[0].split(".").pop()?.toLowerCase();
    const extension = ext === "png" ? "png" : "jpg";
    return { octets: base64VersOctets(base64), typeMime: extension === "png" ? "image/png" : "image/jpeg", extension };
  } catch {
    return null;
  }
}

// Téléverse une image locale vers Supabase Storage et renvoie son URL publique.
// Renvoie null hors ligne / en cas d'échec (l'appelant garde alors l'URI locale).
export async function televerserImage(uri: string, dossier: "produits" | "logos", userId: string): Promise<string | null> {
  if (!estImageLocale(uri)) return uri; // déjà distante
  const image = await lireImage(uri);
  if (!image) return null;

  const chemin = `${dossier}/${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${image.extension}`;
  try {
    const { error } = await supabase.storage.from(BUCKET_IMAGES).upload(chemin, image.octets, {
      contentType: image.typeMime,
      upsert: true,
    });
    if (error) return null;
    const { data } = supabase.storage.from(BUCKET_IMAGES).getPublicUrl(chemin);
    return data.publicUrl;
  } catch {
    return null;
  }
}

// Remplace chaque image locale par son URL distante. Hors ligne, l'URI locale
// est conservée : l'image reste visible sur CET appareil et sera re-téléversée
// à la prochaine modification du produit en ligne.
export async function televerserImagesLocales(uris: string[], dossier: "produits" | "logos", userId: string): Promise<string[]> {
  const resultat: string[] = [];
  for (const uri of uris) {
    const url = await televerserImage(uri, dossier, userId);
    resultat.push(url ?? uri);
  }
  return resultat;
}
