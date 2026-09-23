import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useEssai } from "@/lib/trial/useEssai";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { useConnexion } from "@/lib/useConnexion";
import { useToast } from "@/lib/toast/ToastProvider";

type PlanId = "premium";

export default function OnboardingPlan() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const essai = useEssai();
  const { formater } = useCurrency();
  const enLigne = useConnexion();
  const { showToast } = useToast();
  const [planChoisi, setPlanChoisi] = useState<PlanId>("premium");

  const PLANS: { id: PlanId; nomCle: string; prixCle: string; prixJourCle?: string; descCle: string; fonctionnalitesCle: string; populaire?: boolean }[] = [
    { id: "premium", nomCle: "plan_premium_nom", prixCle: "plan_premium_prix", prixJourCle: "plan_premium_prix_jour", descCle: "plan_premium_description", fonctionnalitesCle: "plan_premium_fonctionnalites", populaire: true },
  ];

  const TEXTE_BOUTON: Record<PlanId, string> = {
    premium: t("bouton_plan_premium", langue),
  };

  // Même logique de teinte que sur l'écran des slides : chaque plan a sa
  // couleur, et le dégradé de fond suit le plan sélectionné.
  const teinteParPlan: Record<PlanId, string> = {
    premium: colors.proFill,
  };
  const couleurDegrade = teinteParPlan[planChoisi];

  async function continuer() {
    // Hors ligne : popup standard de l'app, comme sur les autres écrans.
    if (!enLigne) {
      showToast(t("erreur_connexion_requise", langue), "error");
      return;
    }
    // Paiement Mobile Money in-app (SasPay) — plus de redirection externe.
    router.push("/premium/paiement");
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()} style={{ marginBottom: 16 }}>
          <Feather name="arrow-left" size={22} color={colors.textSecondary} />
        </Pressable>
        <Text style={{ fontSize: 21, fontWeight: "600", color: colors.textPrimary, marginBottom: 6 }}>{t("plan_titre", langue)}</Text>
        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 14, lineHeight: 18, marginBottom:20, display:"flex" }}>
        <Feather name="info" size={13} style={{color:colors.accent, }}  />

           {t("paiement_checkout_info", langue)}
        </Text>

        {PLANS.map((plan) => {
          const selectionne = planChoisi === plan.id;
          const estPremium = plan.id === "premium";
          const couleurAccentCarte = estPremium ? colors.pro : colors.accent;
          return (
            <Pressable
              key={plan.id}
              onPress={() => setPlanChoisi(plan.id)}
              style={[
                styles.carte,
                { backgroundColor: estPremium ? colors.proBg : colors.surface, borderColor: selectionne ? couleurAccentCarte : colors.border, borderWidth: selectionne ? 2 : 1 },
                plan.populaire && { marginTop: 14 },
              ]}
            >
              {plan.populaire && (
                <View style={[styles.badgePopulaire, { backgroundColor: colors.accent }]}>
                  <Text style={styles.texteBadge}>{t("plan_populaire", langue)}</Text>
                </View>
              )}
              <View style={styles.enTeteCarte}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textPrimary }}>{t(plan.nomCle as any, langue)}</Text>
                {selectionne && <Feather name="check-circle" size={18} color={couleurAccentCarte} />}
              </View>
              <View style={styles.ligneBase}>
                <Text style={{ fontSize: 20, fontWeight: "600", color: couleurAccentCarte }}>
                  {essai.prix != null ? `${formater(essai.prix)} / ${t("mois_title",langue)}` : "…"}
                </Text>
                {essai.prix != null && (
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginLeft: 6 }}>(≈ {formater(Math.round(essai.prix / 30))} / {t("jour_title",langue)})</Text>
                )}
              </View>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6, marginBottom: 10, lineHeight: 18 }}>{t(plan.descCle as any, langue)}</Text>
              {(t(plan.fonctionnalitesCle as any, langue) as unknown as string[]).map((f) => (
                <View key={f} style={styles.ligneFonctionnalite}>
                  <Feather name="check" size={13} color={estPremium ? colors.pro : colors.success} />
                  <Text style={{ fontSize: 12, color: colors.textSecondary, flex: 1 }}>{f}</Text>
                </View>
              ))}
            </Pressable>
          );
        })}
        {/* Message de redirection SasPay : affiché ICI (avant le clic), car
            l'écran suivant ouvre directement le checkout hébergé. */}
        
      </ScrollView>

      <View style={[styles.bas, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable
          onPress={continuer}
          style={[styles.boutonPrincipal, { backgroundColor: planChoisi === "premium" ? colors.proFill : colors.accent }]}
        >
          <Text style={[styles.boutonTexte, { color: planChoisi === "premium" ? colors.onPro : "#fff" }]}>{TEXTE_BOUTON[planChoisi]}</Text>
        </Pressable>
      </View>

      {/* Dégradé discret en fond, dans la teinte du plan sélectionné */}
      <LinearGradient
        colors={[`${couleurDegrade}05`, `${couleurDegrade}35`]}
        style={styles.degrade}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 50, paddingBottom: 10 },
  carte: { borderRadius: 16, padding: 18, marginBottom: 14, position: "relative", zIndex: 1 },
  badgePopulaire: { position: "absolute", top: -11, alignSelf: "center", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  texteBadge: { color: "#fff", fontSize: 10, fontWeight: "600" },
  enTeteCarte: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6, marginTop: 4 },
  ligneBase: { flexDirection: "row", alignItems: "baseline" },
  ligneFonctionnalite: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 3 },
  bas: { padding: 20, paddingBottom: 30, borderTopWidth: 1, zIndex: 2 },
  boutonPrincipal: { paddingVertical: 15, borderRadius: 10, alignItems: "center" },
  boutonTexte: { fontSize: 15, fontWeight: "600" },
  degrade: { position: "absolute", bottom: 0, left: 0, right: 0, height: 280, zIndex: 0 },
});