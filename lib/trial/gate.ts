import { useEffect, useState } from "react";
import { estEssaiActifLocal } from "./deviceTrial";
import { etatPlanActuel, rafraichirPlan } from "@/lib/plan/planStore";

// Décide si l'utilisateur peut écrire (ajouter/modifier/supprimer).
// - Plan payant (premium/starter) → toujours autorisé.
// - Sinon → autorisé uniquement pendant l'essai gratuit.
// Fonctionne HORS LIGNE grâce au cache local de l'essai.
export async function peutEcrire(): Promise<boolean> {
  let plan = etatPlanActuel();
  // Jamais de paywall sur une supposition : au démarrage le plan vaut
  // « gratuit » par défaut tant que le serveur n'a pas répondu, et un abonné
  // payant voyait alors le popup « essai terminé ». On vérifie d'abord.
  if (!plan.verifie) {
    await rafraichirPlan().catch(() => {});
    plan = etatPlanActuel();
  }
  if (plan.planId !== "gratuit") return true;

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