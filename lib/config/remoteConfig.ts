import { supabase } from "../supabase/client";

export type RemoteConfig = {
  aiFeaturesEnabled: boolean;
  prixAbonnementMensuel: number;
  limiteVocalGratuitMois: number;
  limiteScanGratuitMois: number;
  dureeMaxVocalSecondes: number;
  modePaiementActif: string[];
};

// Valeurs de secours si la config distante n'a pas pu être lue
// (ex: tout premier lancement hors ligne). Ça garantit que l'app
// démarre toujours, même sans connexion.
const DEFAULT_CONFIG: RemoteConfig = {
  aiFeaturesEnabled: false,
  prixAbonnementMensuel: 2500,
  limiteVocalGratuitMois: 20,
  limiteScanGratuitMois: 5,
  dureeMaxVocalSecondes: 15,
  modePaiementActif: ["mtn_momo", "orange_money"],
};

export async function fetchRemoteConfig(): Promise<RemoteConfig> {
  const { data, error } = await supabase.from("app_config").select("cle, valeur");

  if (error || !data) {
    console.warn("Impossible de lire app_config, utilisation des valeurs par défaut.");
    return DEFAULT_CONFIG;
  }

  const map = Object.fromEntries(data.map((row) => [row.cle, row.valeur]));

  return {
    aiFeaturesEnabled: map.ai_features_enabled === "true",
    prixAbonnementMensuel: Number(map.prix_abonnement_mensuel) || DEFAULT_CONFIG.prixAbonnementMensuel,
    limiteVocalGratuitMois: Number(map.limite_vocal_gratuit_mois) || DEFAULT_CONFIG.limiteVocalGratuitMois,
    limiteScanGratuitMois: Number(map.limite_scan_gratuit_mois) || DEFAULT_CONFIG.limiteScanGratuitMois,
    dureeMaxVocalSecondes: Number(map.duree_max_vocal_secondes) || DEFAULT_CONFIG.dureeMaxVocalSecondes,
    modePaiementActif: map.mode_paiement_actif
      ? JSON.parse(map.mode_paiement_actif)
      : DEFAULT_CONFIG.modePaiementActif,
  };
}
