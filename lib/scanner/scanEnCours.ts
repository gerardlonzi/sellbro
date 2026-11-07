import { ExtractedDocument } from "./types";

// Passage du document analysé entre l'écran caméra / vocal et l'écran de
// validation (un objet structuré ne passe pas proprement dans les paramètres
// de route). La lecture est NON destructive : l'écran de validation peut être
// re-rendu (rechargement à chaud, retour) sans perdre le document ; il appelle
// `viderScanEnCours()` quand l'opération est terminée ou annulée.
export type ScanEnCours = {
  document: ExtractedDocument;
  imageUri: string;
  scanId?: string;
  source?: "scan" | "vocal";
};

let scanEnCours: ScanEnCours | null = null;

export function definirScanEnCours(scan: ScanEnCours) {
  scanEnCours = scan;
}

export function lireScanEnCours(): ScanEnCours | null {
  return scanEnCours;
}

export function viderScanEnCours() {
  scanEnCours = null;
}

export function prendreScanEnCours() {
  const scan = scanEnCours;
  scanEnCours = null;
  return scan;
}
