import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { ProduitCandidat } from "./matching";

// Présélection LOCALE des candidats produits envoyés comme contexte à l'IA
// (§20) : JAMAIS toute la base — au plus `max` noms, les plus récents du
// catalogue. L'IA s'en sert uniquement pour mieux LIRE les libellés de la
// facture ; le matching final reste local (matching.ts).
export async function chargerCandidatsProduits(
  userId: string,
  max = 30
): Promise<{ id: string; nom: string }[]> {
  const produits = (await database
    .get("produits")
    .query(Q.where("user_id", userId), Q.sortBy("cree_le", Q.desc))
    .fetch()) as any[];
  return produits.slice(0, max).map((p) => ({ id: p.id, nom: p.nom }));
}

// Catalogue complet pour le matching LOCAL après analyse : tout reste sur
// l'appareil, aucun envoi réseau. La référence (code-barres / SKU) vit dans
// champs_supplementaires.reference.
export async function chargerCatalogue(userId: string): Promise<ProduitCandidat[]> {
  const produits = (await database
    .get("produits")
    .query(Q.where("user_id", userId))
    .fetch()) as any[];
  return produits.map((p) => ({
    id: p.id,
    nom: p.nom,
    prixVente: p.prixVente,
    reference: p.champsSupplementaires?.reference ?? null,
  }));
}
