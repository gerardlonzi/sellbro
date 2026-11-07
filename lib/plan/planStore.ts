import { Plan, PlanId, chargerPlans, PLANS_PAR_DEFAUT } from "./quotas";
import { supabase } from "@/lib/supabase/client";
import { avecTimeout } from "@/lib/timeout";
import { obtenirUserId } from "@/lib/auth/userCache";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const CLE_OVERRIDE = "plan_test_override";
// Date d'expiration du plan payant, mise en cache avec le plan : sans elle,
// un Premium expiré gardait l'accès complet tant qu'il restait hors ligne.
const CLE_EXPIRATION = "plan_expiration";

export async function lireOverrideTest(): Promise<string | null> {
  if (!__DEV__) return null;
  return AsyncStorage.getItem(CLE_OVERRIDE);
}

// `verifie` répond à une question différente de `pret` : « sait-on vraiment à
// quel plan cet utilisateur a droit ? ». `pret` passe à true dès la lecture
// locale, qui sur une installation neuve ne trouve RIEN — d'où un `planId`
// encore à "gratuit" alors qu'on ne sait rien. Confondre les deux faisait
// afficher « essai gratuit » et le pop-up d'essai à des comptes Pro le temps
// que le serveur réponde (et définitivement si aucun rafraîchissement n'était
// redéclenché après la connexion).
type Etat = { planId: PlanId; plan: Plan | undefined; pret: boolean; verifie: boolean };

// Le plan gratuit est la valeur par défaut dès le départ : `plan` ne doit
// jamais rester `undefined` (sinon les fonctionnalités liées au plan, ex. les
// périodes du dashboard, se verrouillent à tort hors ligne / premier lancement).
let etat: Etat = { planId: "gratuit", plan: PLANS_PAR_DEFAUT.gratuit, pret: false, verifie: false };
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

// Déconnexion : on oublie le plan du compte précédent, sinon il fuite vers le
// suivant (un utilisateur gratuit hériterait du Premium de son prédécesseur).
// Le cache AsyncStorage est effacé aussi : la lecture locale du prochain
// démarrage ne doit pas retrouver l'ancien plan.
export function reinitialiserPlan() {
  etat = { planId: "gratuit", plan: PLANS_PAR_DEFAUT.gratuit, pret: true, verifie: false };
  AsyncStorage.multiRemove(["plan_actuel", CLE_EXPIRATION]).catch(() => {});
  notifier();
}

// Un rafraîchissement est déjà en cours (le hook et l'écouteur d'authentification
// peuvent le déclencher en même temps) : on partage la même promesse au lieu
// d'empiler deux requêtes réseau identiques.
let rafraichissementEnCours: Promise<void> | null = null;

let tentativesRelance = 0;

export function rafraichirPlan(): Promise<void> {
  if (!rafraichissementEnCours) {
    rafraichissementEnCours = executerRafraichissement().finally(() => {
      rafraichissementEnCours = null;
      // Réponse serveur non obtenue (réseau instable juste après la connexion) :
      // on réessaie quelques fois au lieu de rester « inconnu » pour toujours —
      // c'est ce qui faisait parfois disparaître le badge / bouton Pro.
      if (etat.verifie) {
        tentativesRelance = 0;
      } else if (tentativesRelance < 6) {
        tentativesRelance += 1;
        setTimeout(() => { rafraichirPlan().catch(() => {}); }, 4000 * tentativesRelance);
      }
    });
  }
  return rafraichissementEnCours;
}

async function executerRafraichissement(): Promise<void> {
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
    // Un plan trouvé en cache vient d'une réponse serveur : on SAIT.
    etat = { planId: planIdLocal as PlanId, plan: PLANS_PAR_DEFAUT[planIdLocal as PlanId], pret: true, verifie: true };
  } else {
    // Rien en cache : on ne sait toujours pas. On garde le plan gratuit pour
    // l'affichage, mais `verifie` reste false tant que le serveur n'a pas répondu.
    etat = { ...etat, plan: etat.plan ?? PLANS_PAR_DEFAUT.gratuit, pret: true };
  }
  notifier();

  // 2) Rafraîchissement réseau en arrière-plan (ignoré hors ligne).
  try {
    const plans = await chargerPlans();

    if (override && plans[override as PlanId]) {
      etat = { planId: override as PlanId, plan: plans[override as PlanId], pret: true, verifie: true };
      notifier();
      return;
    }
    if (planLocal && plans[planLocal]) {
      etat = { planId: planLocal, plan: plans[planLocal], pret: true, verifie: true };
      notifier();
    }

    // Identifiant lu LOCALEMENT (token stocké) : getUser() fait un appel réseau
    // et, appelé pendant un changement d'état d'authentification, restait
    // bloqué par le verrou d'auth — le plan ne se rafraîchissait jamais après
    // la connexion (d'où « essai terminé » affiché à un abonné Pro).
    const userId = await obtenirUserId();
    if (!userId) {
      // Pas de session : l'absence de plan est une réponse ferme, pas une
      // incertitude — l'utilisateur est bien en gratuit.
      etat = { ...etat, pret: true, verifie: true };
      notifier();
      return;
    }
    // RPC `mon_plan` : une seule requête, TOUJOURS une ligne (plan + date de fin),
    // indépendante de l'existence d'une ligne `profiles`. Repli sur la vue
    // historique si la fonction n'est pas encore déployée.
    let data: { plan_id?: string; date_expiration?: string | null } | null = null;
    let error: any = null;
    {
      const rpc = await avecTimeout(supabase.rpc("mon_plan"), 6000);
      if (!rpc.error && Array.isArray(rpc.data) && rpc.data.length > 0) {
        data = rpc.data[0];
      } else {
        const vue = await avecTimeout(supabase.from("plan_utilisateur").select("plan_id").eq("user_id", userId).maybeSingle(), 6000);
        data = vue.data;
        error = vue.error;
      }
    }
    const planIdNormalise = data?.plan_id;

    if (error) {
      // Requête en échec : on ne conclut RIEN. Sans cette garde, une erreur
      // réseau se lirait comme « aucune ligne de plan » et rétrograderait un
      // abonné Pro en gratuit — définitivement, puisque `verifie` passerait à true.
      etat = { ...etat, pret: true };
      notifier();
      return;
    }

    if (planIdNormalise && plans[planIdNormalise as PlanId]) {
      etat = { planId: planIdNormalise as PlanId, plan: plans[planIdNormalise as PlanId], pret: true, verifie: true };
      await AsyncStorage.setItem("plan_actuel", planIdNormalise);
      // Mémorise la date d'expiration de l'abonnement pour faire respecter
      // la fin de période MÊME HORS LIGNE (sinon le cache « premium »
      // donnait l'accès indéfiniment sans réseau).
      if (planIdNormalise === "gratuit") {
        await AsyncStorage.removeItem(CLE_EXPIRATION);
      } else if (data?.date_expiration) {
        await AsyncStorage.setItem(CLE_EXPIRATION, data.date_expiration);
      } else {
        const { data: abo } = await avecTimeout(supabase
          .from("abonnements")
          .select("date_expiration")
          .eq("user_id", userId)
          .eq("statut", "actif")
          .order("date_expiration", { ascending: false })
          .limit(1)
          .maybeSingle(), 6000);
        if (abo?.date_expiration) await AsyncStorage.setItem(CLE_EXPIRATION, abo.date_expiration);
      }
      notifier();
    } else if (!planIdNormalise) {
      // Le serveur a répondu, sans erreur, et ce compte n'a aucune ligne de
      // plan : il est bien en gratuit — et cette fois on SAIT. C'est cette
      // conclusion qui manquait après une réinstallation suivie d'une connexion.
      etat = { planId: "gratuit", plan: plans.gratuit ?? PLANS_PAR_DEFAUT.gratuit, pret: true, verifie: true };
      await AsyncStorage.setItem("plan_actuel", "gratuit");
      await AsyncStorage.removeItem(CLE_EXPIRATION);
      notifier();
    }
  } catch {
    etat = { ...etat, pret: true };
    notifier();
  }
}