import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import { avecTimeout } from "@/lib/timeout";

// Conversion de devise : le prix de base est stocké UNE SEULE FOIS en FCFA
// (XAF), puis converti vers la devise locale de l'utilisateur selon son pays.
// Un utilisateur hors zone CFA ne voit donc jamais un montant en FCFA.

// Taux de secours (fallback) si la config distante n'est pas joignable.
// Les valeurs réelles sont lues depuis app_config (clé `taux_conversion`).


export const TAUX_DEPUIS_FCFA: Record<string, number> = {
  XAF: 1,
  XOF: 1,

  NGN: 2.2371,
  GHS: 0.02202,
  ZAR: 0.02855,
  KES: 0.2289,
  UGX: 6.4,
  TZS: 4.6759,

  RWF: 2.6091,
  BIF: 5.1,
  CDF: 5.0,

  EGP: 0.09081,
  MAD: 0.01658,
  DZD: 0.2355,

  TND: 0.0006,
  LYD: 0.01119,

  SDG: 1.0,
  SSP: 0.22,
  ETB: 0.25,
  SOS: 0.99,
  DJF: 0.31,
  ERN: 0.026,

  MWK: 3.09,
  ZMW: 0.04,
  BWP: 0.023,
  NAD: 0.031,
  SZL: 0.031,
  LSL: 0.031,

  MZN: 0.11,
  AOA: 1.5,
  SCR: 0.024,
  MUR: 0.078,
  KMF: 0.8,
  CVE: 0.17,
  GMD: 0.11,

  SLE: 0.04,
  LRD: 0.31,
  GNF: 15.2,
};

// Devise par pays (code ISO). Défaut : XAF (Franc CFA) pour les pays non listés.
export const DEVISES_PAR_PAYS: Record<string, string> = {
  CM: "XAF", CI: "XOF", SN: "XOF", BJ: "XOF", BF: "XOF", ML: "XOF", NE: "XOF",
  TG: "XOF", GN: "GNF", CG: "XAF", CD: "CDF", TD: "XAF", CF: "XAF", GA: "XAF",
  GQ: "XAF", NG: "NGN", GH: "GHS", ZA: "ZAR", KE: "KES", UG: "UGX", TZ: "TZS",
  RW: "RWF", BI: "BIF", EG: "EGP", MA: "MAD", DZ: "DZD", TN: "TND", ET: "ETB",
  SO: "SOS", DJ: "DJF", MW: "MWK", ZM: "ZMW", BW: "BWP", NA: "NAD", SZ: "SZL",
  LS: "LSL", MZ: "MZN", AO: "AOA", SC: "SCR", MU: "MUR", KM: "KMF", CV: "CVE",
  GM: "GMD", SL: "SLL", LR: "LRD", LY: "LYD", SD: "SDG", SS: "SSP", ER: "ERN",
};

const CLE_CACHE = "taux_conversion_cache";

// Taux actifs (fallback local + surcharge depuis app_config).
let tauxActifs: Record<string, number> = { ...TAUX_DEPUIS_FCFA };

// Charge les taux depuis la base (app_config), sinon depuis le cache local.
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
export function convertirDepuisFcfa(montantFcfa: number, deviseCode: string): number {
  const taux = tauxActifs[deviseCode] ?? TAUX_DEPUIS_FCFA[deviseCode] ?? 1;
  const valeur = montantFcfa * taux;
  return taux >= 1 ? Math.round(valeur) : Math.max(1, Math.round(valeur));
}