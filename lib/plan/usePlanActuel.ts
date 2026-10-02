import { useEffect, useState } from "react";
import { sAbonnerAuPlan, etatPlanActuel, rafraichirPlan } from "./planStore";

export function usePlanActuel() {
  const [etat, setEtat] = useState(etatPlanActuel());

  useEffect(() => {
    const desabonner = sAbonnerAuPlan(setEtat);
    // `verifie` et non `pret` : au premier lancement `pret` passe à true sans
    // qu'on sache quoi que ce soit du plan, et plus rien ne se rafraîchissait.
    if (!etatPlanActuel().verifie) rafraichirPlan();
    return () => {
      desabonner();
    };
  }, []);

  return etat; // { planId, plan, pret, verifie }
}