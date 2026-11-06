import * as FileSystem from "expo-file-system/legacy";
import { estImageLocale } from "./images";

// Cache disque des images distantes (Supabase Storage) : une fois téléchargée
// (en ligne), l'image reste disponible HORS LIGNE même après fermeture de l'app.
// Le dossier cache du système survit à la fermeture de l'app (il peut être purgé
// par l'OS en cas de manque d'espace — dans ce cas l'image est re-téléchargée).

const DOSSIER_CACHE = `${FileSystem.cacheDirectory}images/`;

// Petit hachage stable (djb2) pour nommer les fichiers de cache.
function hachage(texte: string): string {
  let h = 5381;
  for (let i = 0; i < texte.length; i++) {
    h = ((h << 5) + h + texte.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

async function assurerDossier() {
  const info = await FileSystem.getInfoAsync(DOSSIER_CACHE);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DOSSIER_CACHE, { intermediates: true });
}

export function cheminCache(uri: string): string {
  return `${DOSSIER_CACHE}${hachage(uri)}.img`;
}

// Renvoie le fichier local si l'image distante est déjà en cache, sinon null.
export async function imageDepuisCache(uri: string): Promise<string | null> {
  if (estImageLocale(uri)) return uri;
  try {
    const chemin = cheminCache(uri);
    const info = await FileSystem.getInfoAsync(chemin);
    return info.exists ? chemin : null;
  } catch {
    return null;
  }
}

// Télécharge une image distante dans le cache. Renvoie le chemin local ou null.
export async function telechargerEnCache(uri: string): Promise<string | null> {
  if (estImageLocale(uri)) return uri;
  try {
    await assurerDossier();
    const chemin = cheminCache(uri);
    const resultat = await FileSystem.downloadAsync(uri, chemin);
    return resultat.status === 200 ? chemin : null;
  } catch {
    return null;
  }
}

// Pré-télécharge des images (appelé après une synchronisation) : les images des
// produits et le logo seront ainsi disponibles hors ligne avant même d'être
// affichées une première fois.
export async function prechargerImages(uris: (string | null | undefined)[]): Promise<void> {
  const distantes = uris.filter((u): u is string => !!u && !estImageLocale(u));
  for (const uri of distantes) {
    try {
      const deja = await imageDepuisCache(uri);
      if (!deja) await telechargerEnCache(uri);
    } catch {
      // Hors ligne : on ignorera, l'image sera mise en cache à l'affichage.
    }
  }
}
