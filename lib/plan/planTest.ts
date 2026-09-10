import AsyncStorage from "@react-native-async-storage/async-storage";
import { rafraichirPlan, CLE_OVERRIDE } from "./planStore";

export { lireOverrideTest } from "./planStore";

export async function definirPlanTest(planId: "gratuit" | "premium" | null) {
  if (planId === null) await AsyncStorage.removeItem(CLE_OVERRIDE);
  else await AsyncStorage.setItem(CLE_OVERRIDE, planId);
  await rafraichirPlan();
}