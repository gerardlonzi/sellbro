import { chargerAlias } from "./aliases";
import { chargerCatalogue } from "./candidats";
import { decisionMatch, matcherProduit } from "./matching";
import { ExtractedDocument, LigneScannee } from "./types";

// Après l'analyse IA : matching LOCAL de chaque ligne contre le catalogue et
// les alias du commerçant, puis préparation des lignes pour l'écran de
// validation. Tout se passe sur l'appareil — aucun appel réseau ici (§2, §4).
export async function preparerLignes(
  userId: string,
  document: ExtractedDocument
): Promise<LigneScannee[]> {
  const [produits, alias] = await Promise.all([
    chargerCatalogue(userId),
    chargerAlias(userId),
  ]);

  return document.items.map((item) => {
    const match = matcherProduit(item, produits, alias);
    return {
      ...item,
      match,
      // Présélection seulement si la confiance atteint le seuil de
      // confirmation ; sinon « produit non reconnu » — l'utilisateur choisit.
      produitIdChoisi: decisionMatch(match.score) === "inconnu" ? null : match.productId,
      ignoree: false,
    };
  });
}
