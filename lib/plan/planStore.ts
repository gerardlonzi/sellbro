import { Plan, PlanId, chargerPlans, PLANS_PAR_DEFAUT } from "./quotas";
import { supabase } from "@/lib/supabase/client";
import { avecTimeout } from "@/lib/timeout";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const CLE_OVERRIDE = "plan_test_override";
// Date d'expiration du plan payant, mise en cache avec le plan : sans elle,
// un Premium expiré gardait l'accès complet tant qu'il restait hors ligne.
const CLE_EXPIRATION = "plan_expiration";

export async function lireOverrideTest(): Promise<string | null> {
  if (!__DEV__) return null;
  return AsyncStorage.getItem(CLE_OVERRIDE);
}

type Etat = { planId: PlanId; plan: Plan | undefined; pret: boolean };

// Le plan gratuit est la valeur par défaut dès le départ : `plan` ne doit
// jamais rester `undefined` (sinon les fonctionnalités liées au plan, ex. les
// périodes du dashboard, se verrouillent à tort hors ligne / premier lancement).
let etat: Etat = { planId: "gratuit", plan: PLANS_PAR_DEFAUT.gratuit, pret: false };
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
  // 1) Lecture LOCALE immédiate (fonctionne hors ligne) : le badge du plan
  // s'affiche tout de suite depuis le cache, sans attendre le réseau.
  const override = await lireOverrideTest();
  let planLocal = (await AsyncStorage.getItem("plan_actuel")) as PlanId | null;
  // Un plan payant dont la date d'expiration (mise en cache à la dernière
  // synchro) est dépassée ne vaut plus — MÊME hors ligne. On retombe sur
  // gratuit/essai jusqu'à la prochaine vérification serveur.
  if (planLocal && planLocal !== "gratuit") {
    const expiration = await AsyncStorage.getItem(CLE_EXPIRATION);
    if (expiration && new Date(expiration).getTime() <= Date.now()) {
      planLocal = null;
      await AsyncStorage.removeItem("plan_actuel");
    }
  }
  const planIdLocal = override ?? planLocal;
  if (planIdLocal && PLANS_PAR_DEFAUT[planIdLocal as PlanId]) {
    etat = { planId: planIdLocal as PlanId, plan: PLANS_PAR_DEFAUT[planIdLocal as PlanId], pret: true };
  } else {
    etat = { ...etat, plan: etat.plan ?? PLANS_PAR_DEFAUT.gratuit, pret: true };
  }
  notifier();

  // 2) Rafraîchissement réseau en arrière-plan (ignoré hors ligne).
  try {
    const plans = await chargerPlans();

    if (override && plans[override as PlanId]) {
      etat = { planId: override as PlanId, plan: plans[override as PlanId], pret: true };
      notifier();
      return;
    }
    if (planLocal && plans[planLocal]) {
      etat = { planId: planLocal, plan: plans[planLocal], pret: true };
      notifier();
    }

    const { data: { user } } = await avecTimeout(supabase.auth.getUser(), 6000);
    if (!user) {
      etat = { ...etat, pret: true };
      notifier();
      return;
    }
    const { data } = await avecTimeout(supabase.from("plan_utilisateur").select("plan_id").eq("user_id", user.id).single(), 6000);
    // Normalise « starter » → « premium » : l'app a 2 formules (essai gratuit /
    // payant), donc tout plan payant doit être reconnu comme Premium (sinon un
    // abonné Starter recevrait à tort le popup « essai terminé »).
    const planIdNormalise = data?.plan_id === "starter" ? "premium" : data?.plan_id;
    if (planIdNormalise && plans[planIdNormalise as PlanId]) {
      etat = { planId: planIdNormalise as PlanId, plan: plans[planIdNormalise as PlanId], pret: true };
      await AsyncStorage.setItem("plan_actuel", planIdNormalise);
      // Mémorise la date d'expiration de l'abonnement pour faire respecter
      // la fin de période MÊME HORS LIGNE (sinon le cache « premium »
      // donnait l'accès indéfiniment sans réseau).
      if (planIdNormalise === "gratuit") {
        await AsyncStorage.removeItem(CLE_EXPIRATION);
      } else {
        const { data: abo } = await avecTimeout(supabase
          .from("abonnements")
          .select("date_expiration")
          .eq("user_id", user.id)
          .eq("statut", "actif")
          .order("date_expiration", { ascending: false })
          .limit(1)
          .maybeSingle(), 6000);
        if (abo?.date_expiration) await AsyncStorage.setItem(CLE_EXPIRATION, abo.date_expiration);
      }
      notifier();
    }
  } catch {
    etat = { ...etat, pret: true };
    notifier();
  }
}