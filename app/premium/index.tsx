import { useEffect, useState } from "react";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLangue, t } from "@/lib/i18n";
import { useConnexion } from "@/lib/useConnexion";
import { useToast } from "@/lib/toast/ToastProvider";
import { chargerPlans } from "@/lib/plan/quotas";

import { EcranPlan, PlanId } from "@/components/PlanBloc";

export default function OnboardingPlan() {
  const { langue } = useLangue();
  const enLigne = useConnexion();
  const { showToast } = useToast();
  const [planChoisi, setPlanChoisi] = useState<PlanId>("premium");
  // Prix lus depuis la table `plans` (source de vérité) — jamais en dur.
  const [prixParPlan, setPrixParPlan] = useState<Partial<Record<PlanId, number | null>>>({});

  useEffect(() => {
    chargerPlans()
      .then((plans) => {
        setPrixParPlan({ starter: plans.starter?.prix ?? null, premium: plans.premium?.prix ?? null });
      })
      .catch(() => {});
  }, []);

  async function continuer() {
    // Hors ligne : popup standard de l'app, comme sur les autres écrans.
    if (!enLigne) {
      showToast(t("erreur_connexion_requise", langue), "error");
      return;
    }
    // Mémorise le plan choisi : l'écran de paiement le passe au checkout pour
    // facturer le BON montant (starter ≠ premium) et activer le BON plan.
    await AsyncStorage.setItem("plan_choisi_en_attente", planChoisi);
    // Paiement Mobile Money in-app (SasPay) — plus de redirection externe.
    router.push({ pathname: "/premium/paiement", params: { plan: planChoisi } });
  }

  return (
    <EcranPlan
      plans={["starter", "premium"]}
      planChoisi={planChoisi}
      onChoisir={setPlanChoisi}
      prixParPlan={prixParPlan}
      onContinuer={continuer}
      onRetour={() => router.back()}
      notes={[t("paiement_checkout_info", langue)]}
    />
  );
}
