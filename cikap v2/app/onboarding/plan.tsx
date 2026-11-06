import { useEffect, useState } from "react";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLangue, t } from "@/lib/i18n";
import { demarrerOuVerifierEssaiGratuit } from "@/lib/trial/deviceTrial";
import { chargerPlans } from "@/lib/plan/quotas";
import { usePays } from "@/lib/pays/PaysProvider";
import { prixAbonnementFcfa } from "@/lib/currency/taux";
import { EcranPlan, PlanId } from "@/components/PlanBloc";

export default function OnboardingPlan() {
  const { langue } = useLangue();
  const { pays } = usePays();
  const [planChoisi, setPlanChoisi] = useState<PlanId>("gratuit");
  const [chargement, setChargement] = useState(false);

  // Le prix vient de la base (table plans) — aucune valeur en dur.
  const [prixParPlan, setPrixParPlan] = useState<Partial<Record<PlanId, number | null>>>({});
  useEffect(() => {
    chargerPlans()
      .then((plans) => setPrixParPlan({ starter: plans.starter?.prix ?? null, premium: plans.premium?.prix ?? null }))
      .catch(() => {});
  }, []);

  async function continuer() {
    setChargement(true);
    if (planChoisi === "gratuit") {
      await demarrerOuVerifierEssaiGratuit();
      await AsyncStorage.setItem("onboarding_termine", "true");
      await AsyncStorage.setItem("plan_actuel", "gratuit");
      setChargement(false);
      router.replace("/(tabs)/accueil");
    } else {
      await AsyncStorage.setItem("plan_choisi_en_attente", planChoisi);
      setChargement(false);
      router.push({ pathname: "/premium/paiement", params: { plan: planChoisi } });
    }
  }

  return (
    <EcranPlan
      plans={["gratuit", "starter", "premium"]}
      planChoisi={planChoisi}
      onChoisir={setPlanChoisi}
      prixParPlan={prixParPlan}
      onContinuer={continuer}
      chargement={chargement}
      onRetour={() => router.back()}
      onFermer={() => router.push("/(tabs)/accueil")}
      notes={[t("plan_note_changement", langue)]}
    />
  );
}
