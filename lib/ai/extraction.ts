// Convertit une phrase transcrite (vocale) ou un texte extrait (OCR) en
// données structurées. Approche par règles simples d'abord — gratuite,
// rapide, et suffisante pour un MVP — avant d'envisager un vrai modèle
// de langage si le besoin de précision grandit.

export type VenteExtraite = {
  quantite: number | null;
  produit: string | null;
  prixUnitaire: number | null;
  client: string | null;
};

export function extraireVenteDepuisTexte(texte: string, produitsConnus: string[]): VenteExtraite {
  const texteMinuscule = texte.toLowerCase();

  // Cherche un nombre suivi d'un produit connu (ex: "5 savons")
  const matchQuantite = texteMinuscule.match(/(\d+)\s+(\w+)/);
  const quantite = matchQuantite ? Number(matchQuantite[1]) : null;

  const produit = produitsConnus.find((p) => texteMinuscule.includes(p.toLowerCase())) ?? null;

  // Cherche un montant en FCFA (ex: "500 francs", "500F")
  const matchPrix = texteMinuscule.match(/(\d+)\s*(f|francs|fcfa)/);
  const prixUnitaire = matchPrix ? Number(matchPrix[1]) : null;

  // Cherche un nom propre après "à" ou "pour" (ex: "à Paul")
  const matchClient = texte.match(/(?:à|pour)\s+([A-ZÀ-Ý][a-zà-ÿ]+)/);
  const client = matchClient ? matchClient[1] : null;

  return { quantite, produit, prixUnitaire, client };
}
