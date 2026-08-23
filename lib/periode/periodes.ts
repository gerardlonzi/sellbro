export type PeriodeId = "jour" | "semaine" | "mois" | "semestre" | "annee";

export function plageDates(periode: PeriodeId): { debut: Date; fin: Date } {
  const fin = new Date();
  const debut = new Date();

  switch (periode) {
    case "jour": debut.setHours(0, 0, 0, 0); break;
    case "semaine": debut.setDate(debut.getDate() - 7); break;
    case "mois": debut.setDate(1); debut.setHours(0, 0, 0, 0); break;
    case "semestre": debut.setMonth(debut.getMonth() - 6); break;
    case "annee": debut.setMonth(0, 1); debut.setHours(0, 0, 0, 0); break;
  }

  return { debut, fin };
}