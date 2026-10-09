// Moteur de matching produit (§4-5) : 5 niveaux, du plus fiable au plus
// approximatif. JAMAIS de correspondance aveugle — chaque match porte un
// score, et la décision (auto / confirmation / non reconnu) est prise par
// l'écran de validation via les seuils de `config.ts`.

import { CONFIG_SCANNER } from "./config";
import { normaliserLibelle, normaliserCompact, extraireContenance, distanceNormalisee, recouvrementTokens } from "./normalisation";
import { AliasProduit, ExtractedItem, ProductMatch } from "./types";

export type ProduitCandidat = {
  id: string;
  nom: string;
  prixVente?: number;
  reference?: string | null; // code-barres / SKU (champs_supplementaires.reference)
};

function matchVide(rawName: string): ProductMatch {
  return { productId: null, rawName, matchedName: null, score: 0, method: "none", candidats: [] };
}

// Score final : base de la méthode + bonus contexte (contenance, prix).
function scoreContexte(item: ExtractedItem, nomProduit: string, scoreBase: number): number {
  let score = scoreBase;

  // Contenance : « RUI … 25 KG » favorise « RUIZ 25KG » plutôt que « RUIZ 50KG ».
  const contItem = extraireContenance(item.rawName);
  const contProduit = extraireContenance(nomProduit);
  if (contItem && contProduit) {
    if (contItem.valeur === contProduit.valeur && contItem.unite === contProduit.unite) score += 0.08;
    else if (contItem.unite === contProduit.unite && contItem.valeur !== contProduit.valeur) score -= 0.15;
  }

  return Math.max(0, Math.min(1, score));
}

// Compare un libellé de facture au catalogue + alias du commerçant.
// Ordre : barcode → exact → alias → normalisé → fuzzy + contexte (§20 : tout
// est LOCAL, aucun appel IA ici).
export function matcherProduit(
  item: ExtractedItem,
  produits: ProduitCandidat[],
  alias: AliasProduit[]
): ProductMatch {
  const brut = item.rawName.trim();
  if (!brut) return matchVide(item.rawName);

  // Niveau 1a : code-barres / SKU exact.
  if (item.barcode) {
    const code = item.barcode.trim();
    const trouve = produits.find((p) => p.reference && p.reference.trim() === code);
    if (trouve) {
      return { productId: trouve.id, rawName: item.rawName, matchedName: trouve.nom, score: 1, method: "barcode", candidats: [] };
    }
  }
  if (item.sku) {
    const code = item.sku.trim();
    const trouve = produits.find((p) => p.reference && p.reference.trim() === code);
    if (trouve) {
      return { productId: trouve.id, rawName: item.rawName, matchedName: trouve.nom, score: 1, method: "exact", candidats: [] };
    }
  }

  // Niveau 1b : nom exact (après trim, casse insensible stricte).
  const brutMin = brut.toLowerCase();
  const exact = produits.find((p) => p.nom.trim().toLowerCase() === brutMin);
  if (exact) {
    return { productId: exact.id, rawName: item.rawName, matchedName: exact.nom, score: 1, method: "exact", candidats: [] };
  }

  const norm = normaliserLibelle(brut);
  const compact = normaliserCompact(brut);

  // Niveau 2 : alias appris du commerçant (isolé par user_id en amont).
  const aliasTrouve = alias.find((a) => a.aliasNormalise === norm || normaliserCompact(a.aliasNormalise) === compact);
  if (aliasTrouve) {
    const produit = produits.find((p) => p.id === aliasTrouve.produitId);
    if (produit) {
      // Un alias confirmé par l'utilisateur est quasi certain.
      const score = aliasTrouve.source === "user_confirmed" ? 0.98 : 0.9;
      return { productId: produit.id, rawName: item.rawName, matchedName: produit.nom, score, method: "alias", candidats: [] };
    }
  }

  // Niveau 3 : normalisation (casse/accents/espaces/tirets/ponctuation).
  const normalise = produits.find((p) => normaliserLibelle(p.nom) === norm || normaliserCompact(p.nom) === compact);
  if (normalise) {
    return { productId: normalise.id, rawName: item.rawName, matchedName: normalise.nom, score: 0.95, method: "normalized", candidats: [] };
  }

  // Niveau 4 : fuzzy + contexte — on score tout le catalogue, on garde les
  // meilleurs candidats.
  const scores = produits.map((p) => {
    const distance = distanceNormalisee(brut, p.nom);
    const tokens = recouvrementTokens(brut, p.nom);
    // Base fuzzy : la meilleure des deux mesures.
    const base = Math.max(1 - distance, tokens * 0.9);
    let score = scoreContexte(item, p.nom, base);

    // Proximité de prix (±30 % du prix de vente catalogue) : léger bonus.
    if (item.unitPrice && p.prixVente && p.prixVente > 0) {
      const ecart = Math.abs(item.unitPrice - p.prixVente) / p.prixVente;
      if (ecart <= 0.3) score += 0.03;
    }
    return { produit: p, score: Math.max(0, Math.min(1, score)), distance };
  });

  const candidats = scores
    .filter((s) => s.distance <= CONFIG_SCANNER.fuzzy.distanceMax || s.score >= CONFIG_SCANNER.seuils.confirmation)
    .sort((a, b) => b.score - a.score)
    .slice(0, CONFIG_SCANNER.fuzzy.nbCandidatsMax);

  if (candidats.length === 0) return matchVide(item.rawName);

  const meilleur = candidats[0];
  return {
    productId: meilleur.score >= CONFIG_SCANNER.seuils.confirmation ? meilleur.produit.id : null,
    rawName: item.rawName,
    matchedName: meilleur.produit.nom,
    score: meilleur.score,
    method: "fuzzy",
    candidats: candidats.map((c) => ({ productId: c.produit.id, nom: c.produit.nom, score: c.score })),
  };
}

// Décision d'interface : auto (présélectionné), confirmation (proposé),
// inconnu (aucune présélection).
export function decisionMatch(score: number): "auto" | "confirmation" | "inconnu" {
  if (score >= CONFIG_SCANNER.seuils.auto) return "auto";
  if (score >= CONFIG_SCANNER.seuils.confirmation) return "confirmation";
  return "inconnu";
}
