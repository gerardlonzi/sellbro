// Calcul du bénéfice RÉEL : Σ quantité × (prix de vente − prix d'achat).
// Remplace l'ancienne estimation forfaitaire de 30 % du chiffre d'affaires,
// qui affichait des montants faux (ex. vente à 7 000 avec achat à 5 000
// affichait 2 100 au lieu de 2 000).

export type VentePourBenefice = {
  quantite: number;
  prixUnitaire: number;
  produitId?: string | null;
  // JSON des données supplémentaires de la vente : contient prixAchatUnitaire,
  // le prix d'achat figeAchat au moment de la vente.
  donneesSupplementairesJson?: string | null;
};

export type ProduitPourBenefice = { prixAchat: number | null };

// Pour une ligne de vente : marge réelle si le prix d'achat est connu,
// sinon repli sur l'estimation de 30 % (produit sans prix d'achat renseigné).
export function beneficeLigne(vente: VentePourBenefice, produitsParId: Map<string, ProduitPourBenefice>): number {
  // 1) Prix d'achat figeAchat à la vente (jamais modifié par la suite).
  let figeAchat: number | null = null;
  try {
    const v = vente.donneesSupplementairesJson ? JSON.parse(vente.donneesSupplementairesJson)?.prixAchatUnitaire : null;
    if (typeof v === "number" && Number.isFinite(v)) figeAchat = v;
  } catch {}
  // 2) Anciennes ventes (sans prix figeAchat) : prix d'achat actuel du produit.
  const prixAchat = figeAchat ?? (vente.produitId ? produitsParId.get(vente.produitId)?.prixAchat : null);
  if (prixAchat != null) return vente.quantite * (vente.prixUnitaire - prixAchat);
  return vente.quantite * vente.prixUnitaire * 0.3;
}

export function calculerBenefice(ventes: VentePourBenefice[], produitsParId: Map<string, ProduitPourBenefice>): number {
  return Math.round(ventes.reduce((total, v) => total + beneficeLigne(v, produitsParId), 0));
}
