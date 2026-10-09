import { ExtractedDocument } from "./types";

// Passage du document analysé entre l'écran caméra et l'écran de validation
// (un objet structuré ne passe pas proprement dans les paramètres de route).
let scanEnCours: { document: ExtractedDocument; imageUri: string } | null = null;

export function definirScanEnCours(scan: { document: ExtractedDocument; imageUri: string }) {
  scanEnCours = scan;
}

export function prendreScanEnCours() {
  const scan = scanEnCours;
  scanEnCours = null;
  return scan;
}
