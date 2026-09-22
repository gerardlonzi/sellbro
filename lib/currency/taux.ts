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
};

// Devise par pays (code ISO) — uniquement les pays supportés par SasPay.
export const DEVISES_PAR_PAYS: Record<string, string> = {
  BF: "XOF", BJ: "XOF", CD: "CDF", CI: "XOF", CM: "XAF", GH: "GHS",
  GN: "GNF", KE: "KES", ML: "XOF", MW: "MWK", NE: "XOF", NG: "NGN",
  RW: "RWF", SN: "XOF", TG: "XOF", TZ: "TZS", UG: "UGX", ZM: "ZMW",
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
