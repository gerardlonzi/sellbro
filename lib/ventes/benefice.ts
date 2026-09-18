// Calcul du bénéfice RÉEL : Σ quantité × (prix de vente − prix d'achat).
// Remplace l'ancienne estimation forfaitaire de 30 % du chiffre d'affaires,
// qui affichait des montants faux (ex. vente à 7 000 avec achat à 5 000
// affichait 2 100 au lieu de 2 000).

export type VentePourBenefice = {
  quantite: number;
  prixUnitaire: number;
  produitId?: string | null;
};

export type ProduitPourBenefice = { prixAchat: number | null };

// Pour une ligne de vente : marge réelle si le prix d'achat est connu,
// sinon repli sur l'estimation de 30 % (produit sans prix d'achat renseigné).
export function beneficeLigne(vente: VentePourBenefice, produitsParId: Map<string, ProduitPourBenefice>): number {
  const prixAchat = vente.produitId ? produitsParId.get(vente.produitId)?.prixAchat : null;
  if (prixAchat != null) return vente.quantite * (vente.prixUnitaire - prixAchat);
  return vente.quantite * vente.prixUnitaire * 0.3;
}

export function calculerBenefice(ventes: VentePourBenefice[], produitsParId: Map<string, ProduitPourBenefice>): number {
  return Math.round(ventes.reduce((total, v) => total + beneficeLigne(v, produitsParId), 0));
}
