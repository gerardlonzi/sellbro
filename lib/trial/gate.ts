import { useEffect, useState } from "react";
import { estEssaiActifLocal } from "./deviceTrial";
import { etatPlanActuel } from "@/lib/plan/planStore";

// Décide si l'utilisateur peut écrire (ajouter/modifier/supprimer).
// - Premium → toujours autorisé.
// - Sinon → autorisé uniquement pendant l'essai gratuit.
// Fonctionne HORS LIGNE grâce au cache local de l'essai.
export async function peutEcrire(): Promise<boolean> {
  const plan = etatPlanActuel();
  if (plan.planId === "premium") return true;

  return await estEssaiActifLocal();
}

// Hook React pour la lecture seule visuelle : `false` = mode lecture seule.
export function usePeutEcrire(): boolean {
  const [peut, setPeut] = useState(true);

  useEffect(() => {
    let actif = true;
    peutEcrire().then((v) => {
      if (actif) setPeut(v);
    });
    return () => {
      actif = false;
    };
  }, []);

  return peut;
}