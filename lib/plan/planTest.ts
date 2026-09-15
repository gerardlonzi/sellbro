import AsyncStorage from "@react-native-async-storage/async-storage";
import { rafraichirPlan, CLE_OVERRIDE } from "./planStore";
import { simulerEssaiExpire, simulerEssaiActif } from "@/lib/trial/deviceTrial";

export { lireOverrideTest } from "./planStore";

export async function definirPlanTest(planId: "gratuit" | "premium" | null) {
  if (planId === null) await AsyncStorage.removeItem(CLE_OVERRIDE);
  else await AsyncStorage.setItem(CLE_OVERRIDE, planId);
  await rafraichirPlan();
}

// État « neutre » (FREE) : ni essai actif ni Pro → les écritures sont bloquées.
export async function definirEtatNeutreTest() {
  await definirPlanTest("gratuit");
  await simulerEssaiExpire();
}

// État « essai gratuit » (TRIAL) : accès complet temporaire.
export async function definirEtatTrialTest() {
  await definirPlanTest("gratuit");
  await simulerEssaiActif();
}