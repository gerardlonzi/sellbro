import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { Image } from "react-native";
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

// Compression avant upload : les photos des téléphones font souvent 2-5 Mo.
// On redimensionne à 1600 px de large max (largement suffisant pour produits,
// logos et lecture de documents) et on recompresse. Le PNG est conservé pour
// garder la transparence des logos ; sinon JPEG.
const LARGEUR_MAX = 1600;

function tailleImage(uri: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null)
    );
  });
}

// Renvoie l'URI d'une version compressée (fichier temporaire en cache).
// En cas d'échec, on retourne l'original : mieux vaut une image lourde
// qu'une image perdue.
async function compresserImage(uri: string): Promise<string> {
  try {
    let source = uri;
    // Les data: URI (ex. logo choisi avec base64) passent par un fichier
    // temporaire : ImageManipulator ne travaille que sur des fichiers.
    if (uri.startsWith("data:")) {
      const [entete, donnees] = uri.split(",", 2);
      const ext = entete.includes("png") ? "png" : "jpg";
      const chemin = `${FileSystem.cacheDirectory}cikap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
      await FileSystem.writeAsStringAsync(chemin, donnees, { encoding: FileSystem.EncodingType.Base64 });
      source = chemin;
    }
    // Pas de redimensionnement inutile (ni d'agrandissement) si l'image est
    // déjà assez petite : on ne fait que recompresser.
    const taille = await tailleImage(source);
    const actions = taille && taille.width > LARGEUR_MAX ? [{ resize: { width: LARGEUR_MAX } }] : [];
    const estPng = source.split("?")[0].toLowerCase().endsWith(".png") || uri.startsWith("data:image/png");
    const resultat = await ImageManipulator.manipulateAsync(source, actions, {
      compress: 0.7,
      format: estPng ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG,
    });
    return resultat.uri;
  } catch {
    return uri;
  }
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
  // Compression systématique AVANT la lecture : aucune image ne part vers la
  // base sans être redimensionnée/recompressée.
  const compressee = await compresserImage(uri);
  const image = await lireImage(compressee);
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
