// Abrège un grand montant pour qu'il tienne dans une carte :
//   99 999 → « 99 999 »   100 000 → « 100 K »   1 250 000 → « 1,25 M »   2 000 000 000 → « 2 Md »
// Fonction pure (testable) : l'unité monétaire est ajoutée par l'appelant.
export function abregerMontant(valeur: number, langue: "fr" | "en" = "fr"): string {
  if (!Number.isFinite(valeur)) return "0";
  const signe = valeur < 0 ? "-" : "";
  const abs = Math.abs(valeur);
  const sep = langue === "fr" ? "," : ".";
  const groupe = langue === "fr" ? " " : ",";

  const formaterDecimal = (n: number, maxDec: number) => {
    const texte = n.toFixed(maxDec).replace(/\.?0+$/, "");
    return texte.replace(".", sep);
  };

  if (abs >= 999_950_000) return `${signe}${formaterDecimal(abs / 1_000_000_000, 2)} ${langue === "fr" ? "Md" : "B"}`;
  if (abs >= 999_500) return `${signe}${formaterDecimal(abs / 1_000_000, 2)} M`;
  if (abs >= 100_000) return `${signe}${formaterDecimal(abs / 1_000, abs >= 1_000_000 ? 2 : 1)} K`;
  // < 100 000 : montant entier avec séparateur de milliers.
  return signe + Math.round(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, groupe);
}
