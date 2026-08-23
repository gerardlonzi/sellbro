import { Plan, PlanId, chargerPlans } from "./quotas";
import { lireOverrideTest } from "./planTest";
import { supabase } from "@/lib/supabase/client";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Etat = { planId: PlanId; plan: Plan | undefined; pret: boolean };

let etat: Etat = { planId: "gratuit", plan: undefined, pret: false };
const abonnes = new Set<(e: Etat) => void>();

function notifier() {
  abonnes.forEach((cb) => cb(etat));
}

export function sAbonnerAuPlan(cb: (e: Etat) => void) {
  abonnes.add(cb);
  cb(etat);
  return () => abonnes.delete(cb);
}

export function etatPlanActuel() {
  return etat;
}

export async function rafraichirPlan() {
  const plans = await chargerPlans();

  const override = await lireOverrideTest();
  if (override && plans[override as PlanId]) {
    etat = { planId: override as PlanId, plan: plans[override as PlanId], pret: true };
    notifier();
    return;
  }

  const planLocal = (await AsyncStorage.getItem("plan_actuel")) as PlanId | null;
  if (planLocal && plans[planLocal]) {
    etat = { planId: planLocal, plan: plans[planLocal], pret: true };
    notifier();
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      etat = { ...etat, pret: true };
      notifier();
      return;
    }
    const { data } = await supabase.from("plan_utilisateur").select("plan_id").eq("user_id", user.id).single();
    if (data?.plan_id && plans[data.plan_id as PlanId]) {
      etat = { planId: data.plan_id as PlanId, plan: plans[data.plan_id as PlanId], pret: true };
      await AsyncStorage.setItem("plan_actuel", data.plan_id);
      notifier();
    }
  } catch {
    etat = { ...etat, pret: true };
    notifier();
  }
}