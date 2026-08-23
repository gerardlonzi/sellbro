import { useEffect, useState } from "react";
import { sAbonnerAuPlan, etatPlanActuel, rafraichirPlan } from "./planStore";

export function usePlanActuel() {
  const [etat, setEtat] = useState(etatPlanActuel());

  useEffect(() => {
    const desabonner = sAbonnerAuPlan(setEtat);
    if (!etatPlanActuel().pret) rafraichirPlan();
    return desabonner;
  }, []);

  return etat; // { planId, plan, pret }
}