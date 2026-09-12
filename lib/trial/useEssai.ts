import { useEffect, useState } from "react";
import { obtenirEtatEssaiLocal, demarrerOuVerifierEssaiGratuit, EtatEssai } from "./deviceTrial";
import { usePlanActuel } from "@/lib/plan/usePlanActuel";

export type EssaiInfo = {
  estPremium: boolean;
  actif: boolean;
  joursRestants: number;
  dureeTotale: number;
  prix: number;
  dateFin: string | null;
};

// État unifié de l'essai / abonnement, pour l'affichage (Settings, Accueil,
// pop-ups) et la logique de rappels. La durée totale et le prix viennent de la
// base (plans), les jours restants sont recalculés localement depuis dateFin.
export function useEssai(): EssaiInfo {
  const { plan, planId } = usePlanActuel();
  const [etat, setEtat] = useState<EtatEssai>({ actif: true, joursRestants: 0, dateFin: null });

  useEffect(() => {
    let actif = true;
    (async () => {
      // Rafraîchit côté serveur au premier chargement, sinon cache local.
      const serveur = await demarrerOuVerifierEssaiGratuit();
      const local = await obtenirEtatEssaiLocal();
      if (actif) setEtat(local.actif || serveur.actif ? local : serveur);
    })();
    return () => {
      actif = false;
    };
  }, []);

  const estPremium = planId === "premium";

  return {
    estPremium,
    actif: estPremium || etat.actif,
    joursRestants: etat.joursRestants,
    dureeTotale: plan?.dureeEssaiJours ?? 3,
    prix: plan?.prix ?? 2000,
    dateFin: etat.dateFin,
  };
}