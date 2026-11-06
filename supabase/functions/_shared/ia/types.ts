// Contrat commun des fournisseurs d'IA (OCR / vision et transcription vocale).
// Ajouter un fournisseur : créer ia/<id>.ts, l'ajouter à REGISTRE_IA (index.ts),
// insérer une ligne dans `ia_providers`, poser son secret Supabase.
export type Capacite = "vision" | "audio";

export type EntreeImage = {
  imageBase64: string;
  typeMime: string;
  systeme: string;   // consignes de rôle
  consigne: string;  // demande
  schema: unknown;   // schéma JSON attendu
};

export type EntreeAudio = {
  octets: Uint8Array;
  typeMime: string;   // ex. audio/m4a
  extension: string;  // ex. m4a
  langue?: "fr" | "en";
};

export interface FournisseurIA {
  id: string;
  secretEnv: string;                 // nom du secret Supabase qui contient la clé API
  modeleVisionDefaut?: string;
  modeleAudioDefaut?: string;
  // Renvoie le TEXTE JSON brut produit par le modèle (parsé par l'appelant).
  analyserImage?(e: EntreeImage, cle: string, modele: string, delaiMs: number): Promise<string>;
  // Renvoie la transcription (chaîne vide si aucune parole).
  transcrire?(e: EntreeAudio, cle: string, modele: string, delaiMs: number): Promise<string>;
  // Contrôle léger et gratuit : la clé est-elle acceptée ? (écran Diagnostic)
  verifierCle(cle: string): Promise<{ ok: boolean; detail: string }>;
}

export class ErreurFournisseur extends Error {
  constructor(public fournisseur: string, public statut: number | null, message: string) {
    super(`[${fournisseur}${statut ? ` ${statut}` : ""}] ${message}`);
  }
}

// fetch avec délai maximal : au-delà, on lève une erreur → le basculement passe au suivant.
export async function fetchAvecDelai(fournisseur: string, url: string, init: RequestInit, delaiMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), delaiMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (ctrl.signal.aborted) throw new ErreurFournisseur(fournisseur, null, `délai de ${delaiMs} ms dépassé`);
    throw new ErreurFournisseur(fournisseur, null, `injoignable : ${e}`);
  } finally {
    clearTimeout(minuteur);
  }
}

export function detailCle(statut: number): string {
  return statut === 401 || statut === 403 ? "Clé refusée (invalide, révoquée ou API non activée)"
    : statut === 429 ? "Crédit épuisé ou limite atteinte"
    : `Réponse inattendue (${statut})`;
}
