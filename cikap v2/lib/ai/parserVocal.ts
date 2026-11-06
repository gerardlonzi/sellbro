import { ExtractedDocument, ExtractedItem } from "@/lib/scanner/types";
import { ProduitCandidat, matcherProduit } from "@/lib/scanner/matching";
import { AliasProduit } from "@/lib/scanner/types";
import { normaliserLibelle } from "@/lib/scanner/normalisation";

// Transforme une transcription vocale en document structuré LOCALEMENT.
// L'IA vocale ne fait que transcrire : le matching et la création restent
// du côté Cikap (même contrat que le scanner de documents).

function extraireNombres(texte: string): number[] {
  const matches = texte.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return matches
    .map((n) => parseFloat(n.replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function extraireClient(texte: string): string | null {
  const m = texte.match(/\b(?:à|a|pour|chez)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'\- ]{1,40})/i);
  if (!m) return null;
  const nom = m[1].replace(/\s+(francs?|fcfa|f cfa|cfa|au|le|la|les)\b.*$/i, "").trim();
  return nom.length >= 2 ? nom : null;
}

export function documentDepuisTranscription(
  texte: string,
  produits: ProduitCandidat[],
  alias: AliasProduit[] = []
): ExtractedDocument {
  const brut = texte.trim();
  const nombres = extraireNombres(brut);
  const quantite = nombres.find((n) => n < 200 && Number.isInteger(n)) ?? 1;
  const prix = [...nombres].reverse().find((n) => n >= 50) ?? null;

  const items: ExtractedItem[] = [];
  const texteNorm = normaliserLibelle(brut);

  for (const p of produits) {
    const nom = normaliserLibelle(p.nom);
    if (nom.length < 3) continue;
    if (texteNorm.includes(nom)) {
      items.push({
        rawName: p.nom,
        quantity: quantite,
        unitPrice: prix ?? p.prixVente ?? null,
        totalPrice: prix != null ? prix * quantite : null,
      });
    }
  }

  if (items.length === 0) {
    const match = matcherProduit({ rawName: brut, quantity: quantite, unitPrice: prix }, produits, alias);
    items.push({
      rawName: match.matchedName ?? brut,
      quantity: quantite,
      unitPrice: prix ?? null,
      totalPrice: prix != null ? prix * quantite : null,
    });
  }

  return {
    documentType: "sale",
    customerName: extraireClient(brut),
    currency: "XAF",
    total: items.reduce((s, i) => s + (i.totalPrice ?? (i.unitPrice ?? 0) * (i.quantity ?? 1)), 0) || prix,
    items,
    expenses: [],
    notes: brut,
  };
}
