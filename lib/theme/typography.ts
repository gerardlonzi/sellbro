import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";

// Police de l'app : Plus Jakarta Sans (moderne, très lisible sur petits
// écrans, chiffres nets pour les montants). Sur Android, une police
// personnalisée n'a pas de gras « synthétique » propre : chaque graisse est
// donc une famille distincte, choisie ici à partir du `fontWeight` demandé.
export const POLICES_A_CHARGER = {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
};

export function familleDepuisPoids(poids?: string | number): string {
  const p = poids === undefined || poids === "normal" ? 400 : poids === "bold" ? 700 : Number(poids);
  if (p >= 800) return "PlusJakartaSans_800ExtraBold";
  if (p >= 700) return "PlusJakartaSans_700Bold";
  if (p >= 600) return "PlusJakartaSans_600SemiBold";
  if (p >= 500) return "PlusJakartaSans_500Medium";
  return "PlusJakartaSans_400Regular";
}

// Échelle typographique : à utiliser pour les nouveaux écrans.
export const TYPO = {
  titreEcran: { fontSize: 26, fontWeight: "800" as const, letterSpacing: -0.4 },
  titre: { fontSize: 20, fontWeight: "700" as const, letterSpacing: -0.2 },
  sousTitre: { fontSize: 15, fontWeight: "600" as const },
  corps: { fontSize: 14, fontWeight: "400" as const, lineHeight: 21 },
  petit: { fontSize: 12, fontWeight: "500" as const },
  chiffre: { fontSize: 22, fontWeight: "800" as const, letterSpacing: -0.3 },
};
