import { CATEGORIES_DEPENSES } from "@/lib/depenses/categories";
import { normaliserLibelle } from "./normalisation";
import { Langue, t } from "@/lib/i18n";

// Correspondance entre la catégorie lue par l'IA (« Électricité »,
// « transport »…) et les catégories EXISTANTES de Cikap (§10) : on ne crée
// jamais de nouvelle catégorie si une existante correspond. La comparaison se
// fait sur les libellés traduits (fr + en) ET sur la clé, normalisés.
export function devinerCategorieDepense(brut: string | null | undefined, langue: Langue): string | null {
  if (!brut?.trim()) return null;
  const norm = normaliserLibelle(brut);
  if (!norm) return null;

  for (const cle of CATEGORIES_DEPENSES) {
    if (normaliserLibelle(cle) === norm) return cle;
    // Compare au libellé traduit dans les DEUX langues : l'IA lit souvent le
    // français du ticket même si l'app est en anglais.
    for (const l of ["fr", "en"] as Langue[]) {
      const libelle = t(`depense_cat_${cle}` as any, l);
      if (typeof libelle === "string" && normaliserLibelle(libelle) === norm) return cle;
    }
  }

  // Contenance : « électricité » dans « facture électricité senelec ».
  for (const cle of CATEGORIES_DEPENSES) {
    for (const l of ["fr", "en"] as Langue[]) {
      const libelle = t(`depense_cat_${cle}` as any, l);
      if (typeof libelle === "string") {
        const normLib = normaliserLibelle(libelle);
        if (normLib.length > 2 && norm.includes(normLib)) return cle;
      }
    }
  }
  return null;
}
