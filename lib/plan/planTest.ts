import AsyncStorage from "@react-native-async-storage/async-storage";
import { rafraichirPlan } from "./planStore";

const CLE_OVERRIDE = "plan_test_override";

export async function definirPlanTest(planId: "gratuit" | "starter" | "premium" | null) {
  if (planId === null) await AsyncStorage.removeItem(CLE_OVERRIDE);
  else await AsyncStorage.setItem(CLE_OVERRIDE, planId);
  await rafraichirPlan(); // notifie TOUS les écrans ouverts, immédiatement
}

export async function lireOverrideTest(): Promise<string | null> {
  if (!__DEV__) return null;
  return AsyncStorage.getItem(CLE_OVERRIDE);
}