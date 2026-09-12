import { Pays } from "./pays";

// Nombre de chiffres locaux (sans l'indicatif) attendu par pays.
// Clé = code pays ISO. Valeurs par défaut appliquées quand le pays
// n'a pas d'entrée explicite (9 chiffres pour la plupart des mobiles).
const LONGUEURS_PAR_PAYS: Record<string, number[]> = {
  CM: [9], // Cameroun
  CI: [10], // Côte d'Ivoire
  SN: [9], // Sénégal
  NG: [10], // Nigéria
  BJ: [8], // Bénin
  ML: [8], // Mali
  NE: [8], // Niger
  TG: [8], // Togo
  GN: [9], // Guinée
  BF: [8], // Burkina Faso
  GA: [7], // Gabon
  CG: [9], // Congo
  CD: [9], // RD Congo
  TD: [8], // Tchad
  CF: [8], // Centrafrique
  MA: [9], // Maroc
  DZ: [9], // Algérie
  TN: [8], // Tunisie
};

export function longueursAutorisees(pays: Pays): number[] {
  return pays.longueurs ?? LONGUEURS_PAR_PAYS[pays.code] ?? [9];
}

export type ResultatValidation = { valide: boolean; message?: string };

// Valide un numéro de téléphone local (sans indicatif) selon le pays choisi :
// uniquement des chiffres, et une longueur autorisée par le pays.
export function validerTelephone(numero: string, pays: Pays): ResultatValidation {
  const chiffres = numero.replace(/\D/g, "");
  if (chiffres.length === 0) {
    return { valide: false, message: "Le numéro est vide." };
  }
  // Caractères non numériques (lettres, symboles) → invalide.
  if (numero.replace(/\s/g, "") !== chiffres) {
    return { valide: false, message: "Le numéro ne doit contenir que des chiffres." };
  }
  const longueurs = longueursAutorisees(pays);
  if (!longueurs.includes(chiffres.length)) {
    return { valide: false, message: `Le numéro doit contenir ${longueurs.join(" ou ")} chiffres.` };
  }
  return { valide: true };
}