import { Pays } from "./pays";

// Nombre de chiffres locaux (sans l'indicatif) attendu par pays.
// Clé = code pays ISO. Valeurs par défaut appliquées quand le pays
// n'a pas d'entrée explicite (9 chiffres pour la plupart des mobiles).
const LONGUEURS_PAR_PAYS: Record<string, number[]> = {
  CM: [9], // Cameroun
  CI: [10], // Côte d'Ivoire
  SN: [9], // Sénégal
  BJ: [8], // Bénin
  BF: [8], // Burkina Faso
  ML: [8], // Mali
  NE: [8], // Niger
  TG: [8], // Togo
  GN: [9], // Guinée
  CD: [9], // République Démocratique du Congo
  CG: [9], // Congo
  GA: [7], // Gabon
  GH: [10], // Ghana
  KE: [9, 10], // Kenya
  MW: [9], // Malawi
  NG: [10], // Nigéria
  RW: [9], // Rwanda
  TZ: [9], // Tanzanie
  UG: [9], // Ouganda
  ZM: [9], // Zambie
  SO: [9], // Somalie
  ET: [9], // Éthiopie
  SL: [8], // Sierra Leone
  MA: [9], // Maroc
  DZ: [9], // Algérie
  TN: [8], // Tunisie
  EG: [10], // Égypte
  ZA: [9], // Afrique du Sud
  MG: [9], // Madagascar
  MU: [7], // Maurice
  MZ: [9], // Mozambique
  SD: [9], // Soudan
  SS: [9], // Soudan du Sud
  ZW: [9], // Zimbabwe
  AO: [9], // Angola
  BI: [8], // Burundi
  CV: [7], // Cap-Vert
  CF: [8], // Centrafrique
  KM: [7], // Comores
  DJ: [8], // Djibouti
  ER: [7], // Érythrée
  SZ: [8], // Eswatini
  GM: [7], // Gambie
  LS: [8], // Lesotho
  LR: [7, 8], // Libéria
  LY: [9], // Libye
  MR: [8], // Mauritanie
  NA: [9], // Namibie
  ST: [7], // Sao Tomé-et-Principe
  SC: [7], // Seychelles
  TD: [8], // Tchad

  // Amériques
  US: [10], // États-Unis
  CA: [10], // Canada
  BR: [10, 11], // Brésil
  MX: [10], // Mexique
  AR: [10], // Argentine
  CL: [9], // Chili
  CO: [10], // Colombie
  PE: [9], // Pérou
  VE: [10], // Venezuela
  UY: [8], // Uruguay
  PY: [9], // Paraguay
  BO: [8, 9], // Bolivie
  EC: [9], // Équateur
  CR: [8], // Costa Rica
  CU: [8], // Cuba
  DO: [10], // République Dominicaine
  GT: [8], // Guatemala
  HT: [8], // Haïti
  HN: [8], // Honduras
  NI: [8], // Nicaragua
  PA: [8], // Panama
  SV: [8], // Salvador
  BS: [7], // Bahamas
  BB: [7], // Barbade
  BZ: [7], // Belize
  DM: [7], // Dominique
  GD: [7], // Grenade
  GY: [7], // Guyana
  JM: [10], // Jamaïque
  KN: [7], // Saint-Christophe-et-Niévès
  LC: [7], // Sainte-Lucie
  VC: [7], // Saint-Vincent-et-les-Grenadines
  SR: [6, 7], // Suriname
  TT: [7], // Trinité-et-Tobago

  // Europe
  FR: [9], // France
  GB: [10], // Royaume-Uni
  DE: [10, 11], // Allemagne
  ES: [9], // Espagne
  IT: [9, 10], // Italie
  PT: [9], // Portugal
  BE: [9], // Belgique
  CH: [9], // Suisse
  NL: [9], // Pays-Bas
  AT: [4, 13], // Autriche
  SE: [9], // Suède
  NO: [8], // Norvège
  DK: [8], // Danemark
  FI: [9], // Finlande
  IE: [9], // Irlande
  PL: [9], // Pologne
  RO: [9], // Roumanie
  GR: [10], // Grèce
  CZ: [9], // Tchéquie
  HU: [9], // Hongrie
  UA: [9], // Ukraine
  RU: [10], // Russie
  BY: [9], // Biélorussie
  MD: [8], // Moldavie
  BA: [8], // Bosnie-Herzégovine
  HR: [9], // Croatie
  RS: [9], // Serbie
  ME: [8], // Monténégro
  AL: [9], // Albanie
  MK: [8], // Macédoine du Nord
  BG: [9], // Bulgarie
  CY: [8], // Chypre
  EE: [7, 8], // Estonie
  IS: [7], // Islande
  LV: [8], // Lettonie
  LT: [8], // Lituanie
  LU: [9], // Luxembourg
  MT: [8], // Malte
  MC: [8, 9], // Monaco
  SM: [10], // Saint-Marin
  VA: [10], // Vatican
  AD: [6], // Andorre
  LI: [7], // Liechtenstein
  SI: [8], // Slovénie
  SK: [9], // Slovaquie

  // Asie & Moyen-Orient
  CN: [11], // Chine
  IN: [10], // Inde
  JP: [10], // Japon
  KR: [9, 10], // Corée du Sud
  ID: [9, 10, 11, 12], // Indonésie
  PK: [10], // Pakistan
  BD: [10], // Bangladesh
  PH: [10], // Philippines
  VN: [9, 10], // Vietnam
  IR: [10], // Iran
  TR: [10], // Turquie
  TH: [9], // Thaïlande
  MM: [9, 10], // Myanmar
  IQ: [10], // Irak
  SA: [9], // Arabie Saoudite
  UZ: [9], // Ouzbékistan
  MY: [9, 10], // Malaisie
  YE: [9], // Yémen
  NP: [10], // Népal
  KP: [9, 10], // Corée du Nord
  LK: [9], // Sri Lanka
  KZ: [9], // Kazakhstan
  SY: [9], // Syrie
  KH: [8, 9], // Cambodge
  JO: [9], // Jordanie
  AZ: [9], // Azerbaïdjan
  AE: [9], // Émirats Arabes Unis
  TJ: [9], // Tadjikistan
  IL: [9], // Israël
  LA: [9], // Laos
  LB: [8], // Liban
  KG: [9], // Kirghizistan
  TM: [8], // Turkménistan
  SG: [8], // Singapour
  PS: [9], // Palestine
  KW: [8], // Koweït
  OM: [8], // Oman
  QA: [8], // Qatar
  BH: [8], // Bahreïn
  TL: [7, 8], // Timor Oriental
  MN: [8], // Mongolie
  AM: [8], // Arménie
  GE: [9], // Géorgie
  BN: [7], // Brunei
  BT: [8], // Bhoutan
  MV: [7], // Maldives

  // Océanie
  AU: [9], // Australie
  NZ: [9], // Nouvelle-Zélande
  PG: [7, 8], // Papouasie-Nouvelle-Guinée
  FJ: [7], // Fidji
  SB: [5], // Îles Salomon
  VU: [5], // Vanuatu
  WS: [5, 6, 7], // Samoa
  KI: [8], // Kiribati
  FM: [7], // Micronésie
  MH: [7], // Îles Marshall
  NR: [7], // Nauru
  PW: [7], // Palaos
  TO: [5], // Tonga
  TV: [5], // Tuvalu
};

export function longueursAutorisees(pays: Pays): number[] {
  return pays.longueurs ?? LONGUEURS_PAR_PAYS[pays.code] ?? [9];
}

export type ResultatValidation = { valide: boolean; message?: string };

// Valide un numéro de téléphone local (sans indicatif) selon le pays choisi :
// uniquement des chiffres, et une longueur autorisée par le pays.
export function validerTelephone(numero: string, pays: Pays, langue: "fr" | "en" = "fr"): ResultatValidation {
  const fr = langue === "fr";
  const chiffres = numero.replace(/\D/g, "");
  if (chiffres.length === 0) {
    return { valide: false, message: fr ? "Le numéro est vide." : "The number is empty." };
  }
  // Caractères non numériques (lettres, symboles) → invalide.
  if (numero.replace(/\s/g, "") !== chiffres) {
    return { valide: false, message: fr ? "Le numéro ne doit contenir que des chiffres." : "The number must contain digits only." };
  }
  const longueurs = longueursAutorisees(pays);
  if (!longueurs.includes(chiffres.length)) {
    return { valide: false, message: fr ? `Le numéro doit contenir ${longueurs.join(" ou ")} chiffres.` : `The number must contain ${longueurs.join(" or ")} digits.` };
  }
  return { valide: true };
}