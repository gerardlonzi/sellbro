import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";

// Conversion de devise : le prix de base est stocké UNE SEULE FOIS en FCFA
// (XAF), puis converti vers la devise locale de l'utilisateur selon son pays.
// Un utilisateur hors zone CFA ne voit donc jamais un montant en FCFA.

// Taux de secours (fallback) si la config distante n'est pas joignable.
// Les valeurs réelles sont lues depuis app_config (clé `taux_conversion`).
export const TAUX_DEPUIS_FCFA: Record<string, number> = {
  XAF: 1,
  XOF: 1,
  NGN: 0.42, GHS: 0.015, ZAR: 0.032, KES: 0.21, UGX: 6.1, TZS: 4.4,
  RWF: 2.2, BIF: 5.0, CDF: 4.8, EGP: 0.082, MAD: 0.017, DZD: 0.23,
  TND: 0.0054, LYD: 0.0082, SDG: 1.0, SSP: 0.22, ETB: 0.19, SOS: 0.95,
  DJF: 0.30, ERN: 0.025, MWK: 2.9, ZMW: 0.045, BWP: 0.023, NAD: 0.032,
  SZL: 0.032, LSL: 0.032, MZN: 0.11, AOA: 1.5, SCR: 0.024, MUR: 0.077,
  KMF: 0.82, CVE: 0.17, GMD: 0.11, SLL: 0.037, LRD: 0.31, GNF: 14.7,
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
    const { data, error } = await supabase
      .from("app_config")
      .select("valeur")
      .eq("cle", "taux_conversion")
      .single();
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