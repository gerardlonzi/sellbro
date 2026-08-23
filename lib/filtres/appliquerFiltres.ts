import { ValeursFiltre } from "./types";

export function dansPeriode(dateISO: string, valeurs: ValeursFiltre): boolean {
  if (valeurs.periode === "tous") return true;
  const date = new Date(dateISO);
  const maintenant = new Date();

  if (valeurs.periode === "aujourdhui") {
    return date.toDateString() === maintenant.toDateString();
  }
  if (valeurs.periode === "semaine") {
    const ilYA7Jours = new Date();
    ilYA7Jours.setDate(ilYA7Jours.getDate() - 7);
    return date >= ilYA7Jours;
  }
  if (valeurs.periode === "mois") {
    return date.getMonth() === maintenant.getMonth() && date.getFullYear() === maintenant.getFullYear();
  }
  if (valeurs.periode === "personnalisee") {
    if (valeurs.dateDebut && date < new Date(valeurs.dateDebut)) return false;
    if (valeurs.dateFin && date > new Date(valeurs.dateFin)) return false;
    return true;
  }
  return true;
}

export function dansPlageMontant(montant: number, valeurs: ValeursFiltre): boolean {
  if (valeurs.montantMin && montant < Number(valeurs.montantMin)) return false;
  if (valeurs.montantMax && montant > Number(valeurs.montantMax)) return false;
  return true;
}