import { Langue } from "@/lib/i18n";

// Helpers de dates en HEURE LOCALE. Évite le décalage d'un jour provoqué par
// `toISOString()` (UTC) ou par `new Date("YYYY-MM-DD")` (parsé en UTC).

// "YYYY-MM-DD" en heure locale (remplace `date.toISOString().split("T")[0]`).
export function formaterDateSeule(date: Date): string {
  const a = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const j = String(date.getDate()).padStart(2, "0");
  return `${a}-${m}-${j}`;
}

// Parse "YYYY-MM-DD" comme date locale à minuit (remplace `new Date("YYYY-MM-DD")`).
export function parserDateSeule(valeur: string): Date {
  const [a, m, j] = valeur.split("-").map(Number);
  return new Date(a, (m || 1) - 1, j || 1);
}

// Accepte un Date, un timestamp ou une chaîne "YYYY-MM-DD" ; affiche la date locale.
export function formaterDate(d: Date | string | number | null | undefined, langue: Langue = "fr"): string {
  if (d == null) return "—";
  const date = typeof d === "string" ? (/^\d{4}-\d{2}-\d{2}$/.test(d) ? parserDateSeule(d) : new Date(d)) : new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(langue === "fr" ? "fr-FR" : "en-US");
}

export function formaterDateHeure(d: Date | string | number | null | undefined, langue: Langue = "fr"): string {
  if (d == null) return "—";
  const date = typeof d === "string" ? (/^\d{4}-\d{2}-\d{2}$/.test(d) ? parserDateSeule(d) : new Date(d)) : new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString(langue === "fr" ? "fr-FR" : "en-US");
}