import { t, Langue } from "@/lib/i18n";

// Catégories de dépenses prédéfinies (clés i18n depense_cat_*).
export const CATEGORIES_DEPENSES = ["loyer", "electricite", "transport", "salaire", "internet", "autre"];

// Libellé d'affichage : traduit si la catégorie est prédéfinie, sinon le nom
// personnalisé tel que saisi par l'utilisateur.
export function libelleCategorieDepense(categorie: string, langue: Langue): string {
  if (CATEGORIES_DEPENSES.includes(categorie)) {
    return t(`depense_cat_${categorie}` as any, langue) as string;
  }
  return categorie;
}
