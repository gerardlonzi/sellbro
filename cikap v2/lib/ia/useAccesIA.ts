import { usePlanActuel } from "@/lib/plan/usePlanActuel";
import { useEssai } from "@/lib/trial/useEssai";

// Accès aux fonctions IA (scan documents / vocal) : Premium (quotas lus
// depuis `plans`) OU essai gratuit actif. Starter et gratuit hors essai = 0.
export function useAccesIA(): { accesScan: boolean; accesVocal: boolean } {
  const { plan } = usePlanActuel();
  const essai = useEssai();
  const essaiActif = essai.statut === "TRIAL";
  return {
    accesScan: (plan?.quotaScan ?? 0) > 0 || essaiActif,
    accesVocal: (plan?.quotaVocal ?? 0) > 0 || essaiActif,
  };
}
