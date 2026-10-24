import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import { avecTimeout } from "@/lib/timeout";

// Conversion de devise : le prix de base est stocké UNE SEULE FOIS en FCFA
// (XAF), puis converti vers la devise locale de l'utilisateur selon son pays.
// Un utilisateur hors zone CFA ne voit donc jamais un montant en FCFA.
//
// Seules les devises des pays supportés par SasPay sont gérées (voir
// lib/paiement/reseaux.ts). Les taux réels sont lus depuis app_config
// (clé `taux_conversion`) en ligne, puis mis en cache pour le hors ligne.

// Taux de secours (fallback) si la config distante ET le cache sont absents.
export const TAUX_DEPUIS_FCFA: Record<string, number> = {
  // Afrique
  XAF: 1,
  XOF: 1,
  CDF: 5.0,
  GHS: 0.02202,
  GNF: 15.2,
  KES: 0.2289,
  MWK: 3.09,
  NGN: 2.2371,
  RWF: 2.6091,
  TZS: 4.6759,
  UGX: 6.4,
  ZMW: 0.04,
  ETB: 0.095,
  SLE: 0.035,
  SOS: 0.95, // Somalie (SOS)
  ZAR: 0.032,
  MAD: 0.017,
  DZD: 0.22,
  TND: 0.0052,
  EGP: 0.082,
  AOA: 1.45,
  BIF: 5.8,
  CVE: 0.17,
  KMF: 0.75,
  DJF: 0.29,
  ERN: 0.024,
  SZL: 0.032,
  GMD: 0.11,
  LSL: 0.032,
  LRD: 0.28,
  LYD: 0.0076,
  MRO: 0.060,
  MZN: 0.10,
  NAD: 0.032,
  STN: 0.0039,
  SCR: 0.018,
  SDG: 0.95,
  ZWD: 3.8,

  // International / Global / USD / Crypto / Autres devises de la liste
  USD: 0.0016,
  EUR: 0.0015,
  GBP: 0.0013,
  CAD: 0.0022,
  BRL: 0.0092,
  INR: 0.134,
  CNY: 0.011,
  JPY: 0.24,
  AUD: 0.0024,
  NZD: 0.0026,
  CHF: 0.0014,
  AED: 0.0059,
  SAR: 0.0060,
  QAR: 0.0058,
  XCD: 0.0043,
  XPF: 0.18,
};// Devise par pays (code ISO) — uniquement les pays supportés par SasPay.
export const DEVISES_PAR_PAYS: Record<string, string> = {
  // Afrique
  CM: "XAF", CG: "XAF", GA: "XAF", CF: "XAF", TD: "XAF", GQ: "XAF",
  BF: "XOF", BJ: "XOF", CI: "XOF", ML: "XOF", NE: "XOF", SN: "XOF", TG: "XOF", GW: "XOF",
  CD: "CDF", 
  GH: "GHS",
  GN: "GNF", 
  KE: "KES", 
  MW: "MWK", 
  NG: "NGN",
  RW: "RWF", 
  TZ: "TZS", 
  UG: "UGX", 
  ZM: "ZMW",
  SO: "SOS", // Somalie
  ET: "ETB", 
  SL: "SLE", 
  MA: "MAD", 
  DZ: "DZD", 
  TN: "TND",
  EG: "EGP", ZA: "ZAR", AO: "AOA", BI: "BIF", CV: "CVE",
  KM: "KMF", DJ: "DJF", ER: "ERN", SZ: "SZL", GM: "GMD",
  LS: "LSL", LR: "LRD", LY: "LYD", MR: "MRO", MU: "MUR",
  MZ: "MZN", NA: "NAD", SC: "SCR", SDG: "SDG", ST: "STN",
  ZW: "ZWD",

  // Amériques
  US: "USD", CA: "CAD", BR: "BRL", MX: "MXN", AR: "ARS",
  CL: "CLP", CO: "COP", PE: "PEN", VE: "VES", UY: "UYU",
  PY: "PYG", BO: "BOB", EC: "USD", CR: "CRC", CU: "CUP",
  DO: "DOP", GT: "GTQ", HT: "HTG", HN: "HNL", NI: "NIO",
  PA: "PAB", SV: "USD", BS: "BSD", BB: "BBD", BZD: "BZD",
  DM: "XCD", GD: "XCD", GY: "GYD", JM: "JMD", KN: "XCD",
  LC: "XCD", VC: "XCD", SR: "SRD", TT: "TTD",

  // Europe
  FR: "EUR", DE: "EUR", ES: "EUR", IT: "EUR", PT: "EUR",
  BE: "EUR", NL: "EUR", AT: "EUR", FI: "EUR", IE: "EUR",
  GR: "EUR", CY: "EUR", EE: "EUR", LV: "EUR", LT: "EUR",
  LU: "EUR", MT: "EUR", SK: "EUR", SI: "EUR", HR: "EUR",
  GB: "GBP", CH: "CHF", NO: "NOK", DK: "DKK", SE: "SEK",
  PL: "PLN", RO: "RON", CZ: "CZK", HU: "HUF", UA: "UAH",
  RU: "RUB", BY: "BYN", MD: "MDL", BA: "BAM", RS: "RSD",
  ME: "EUR", AL: "ALL", MK: "MKD", BG: "BGN", IS: "ISK",
  MC: "EUR", SM: "EUR", VA: "EUR", AD: "EUR", LI: "CHF",

  // Asie & Moyen-Orient
  CN: "CNY", IN: "INR", JP: "JPY", KR: "KRW", ID: "IDR",
  PK: "PKR", BD: "BDT", PH: "PHP", VN: "VND", IR: "IRR",
  TR: "TRY", TH: "THB", MM: "MMK", IQ: "IQD", SA: "SAR",
  UZ: "UZS", MY: "MYR", YE: "YER", NPR: "NPR", KP: "KPW",
  LK: "LKR", KZ: "KZT", SY: "SYP", KH: "KHR", JO: "JOD",
  AZ: "AZN", AE: "AED", TJ: "TJS", IL: "ILS", LA: "LAK",
  LB: "LBP", KG: "KGS", TMT: "TMT", SG: "SGD", PS: "ILS",
  KW: "KWD", OM: "OMR", QA: "QAR", BH: "BHD", TL: "USD",
  MN: "MNT", AM: "AMD", GE: "GEL", BND: "BND", BTN: "BTN",
  MVR: "MVR",

  // Océanie
  AU: "AUD", NZ: "NZD", PG: "PGK", FJ: "FJD", SB: "SBD",
  VU: "VUV", WS: "WST", KI: "AUD", FM: "USD", MH: "USD",
  NR: "AUD", PW: "USD", TO: "TOP", TV: "AUD",
  
  // Cas spéciaux UI (Somalie/Crypto)
  XC: "USD",
  XY: "USD"
};

const CLE_CACHE = "taux_conversion_cache";

// Taux actifs (fallback local + surcharge depuis app_config).
let tauxActifs: Record<string, number> = { ...TAUX_DEPUIS_FCFA };

// Charge les taux depuis la base (app_config), sinon depuis le cache local.
// Appelé au démarrage (CurrencyProvider) — après l'inscription, les taux sont
// donc récupérés en ligne puis sauvegardés localement pour le hors ligne.
export async function chargerTauxDepuisConfig(): Promise<void> {
  try {
    // Timeout : hors ligne l'appel peut rester pendu et geler le démarrage.
    const { data, error } = await avecTimeout(
      supabase.from("app_config").select("valeur").eq("cle", "taux_conversion").single(),
      5000
    );
    if (!error && data?.valeur) {
      const parses = JSON.parse(data.valeur);
      tauxActifs = { ...TAUX_DEPUIS_FCFA, ...parses };
      await AsyncStorage.setItem(CLE_CACHE, data.valeur);
      return;
    }
  } catch {
    // Réseau / hors ligne → cache local.
  }
  const cache = await AsyncStorage.getItem(CLE_CACHE);
  if (cache) {
    try {
      tauxActifs = { ...TAUX_DEPUIS_FCFA, ...JSON.parse(cache) };
    } catch {}
  }
}

// Convertit un montant en FCFA (XAF) vers la devise cible.
// Un montant invalide (null/NaN, ex. prix pas encore chargé hors ligne) donne
// 0 au lieu de « NaN » — les écrans de prix testent `!= null` avant d'afficher.
export function convertirDepuisFcfa(montantFcfa: number, deviseCode: string): number {
  if (typeof montantFcfa !== "number" || !Number.isFinite(montantFcfa)) return 0;
  const taux = tauxActifs[deviseCode] ?? TAUX_DEPUIS_FCFA[deviseCode] ?? 1;
  const valeur = montantFcfa * taux;
  return taux >= 1 ? Math.round(valeur) : Math.max(1, Math.round(valeur));
}
