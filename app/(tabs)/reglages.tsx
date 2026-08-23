import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { usePlanActuel } from "@/lib/plan/usePlanActuel";
import { definirPlanTest } from "@/lib/plan/planTest";
import { Carte } from "@/components/UI";
import { useAbonnement } from "@/lib/plan/useAbonnement";

// ...

export default function Reglages() {
  const { colors, mode, setMode } = useTheme();
  const { langue } = useLangue();
  const { planId, plan } = usePlanActuel();
  const { expire } = useAbonnement();


  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={{ fontSize: 16, fontWeight: "500", color: colors.textPrimary, marginBottom: 16 }}>
        {t("reglages_titre", langue)}
      </Text>

      <Carte style={{ marginBottom: 12 }}>
        <View style={styles.ligneAbonnement}>
          <View>
            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{plan?.nom ?? "—"}</Text>
            {plan && (
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                {plan.quotaVocal} {t("reglages_vocaux_mois", langue)} · {plan.quotaScan} {t("reglages_scans_mois", langue)}
              </Text>
            )}
          </View>
          {expire ? (
            <Pressable onPress={() => router.push("/premium")} style={[styles.boutonPro, { backgroundColor: colors.danger }]}>
              <Text style={{ color: "#fff", fontSize: 11 }}>{t("reglages_renouveler", langue)}</Text>
            </Pressable>
          ) : planId !== "premium" ? (
            <Pressable onPress={() => router.push("/premium")} style={[styles.boutonPro, { backgroundColor: colors.pro }]}>
              <Text style={{ color: colors.onPro, fontSize: 11 }}>{t("reglages_upgrade", langue)}</Text>
            </Pressable>
          ) : null}
        </View>
        {expire && (
          <Text style={{ color: colors.danger, fontSize: 11, marginTop: 8 }}>{t("reglages_abonnement_expire", langue)}</Text>
        )}
      </Carte>

      <SectionTitre titre={t("reglages_apparence", langue)} />
      <Carte style={{ marginBottom: 16 }}>
        <View style={styles.ligneOptions}>
          {(["clair", "sombre", "auto"] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={[styles.optionMode, { borderColor: mode === m ? colors.accent : colors.border, borderWidth: mode === m ? 2 : 1 }]}
            >
              <Text style={{ color: mode === m ? colors.accent : colors.textPrimary, fontSize: 12 }}>
                {t(`reglages_theme_${m}` as any, langue)}
              </Text>
            </Pressable>
          ))}
        </View>
      </Carte>

      <SectionTitre titre={t("reglages_section_boutique", langue)} />
      <Carte style={{ marginBottom: 16 }}>
        <LigneReglage icone="home" label={t("reglages_info_boutique", langue)} onPress={() => router.push("/reglages/boutique")} />
        <LigneReglage icone="tag" label={t("reglages_categories", langue)} onPress={() => router.push("/reglages/categories")} />
        <LigneReglage icone="users" label="Employés" onPress={() => router.push("/reglages/employes")} dernier />
      </Carte>

      <SectionTitre titre={t("reglages_section_general", langue)} />
      <Carte style={{ marginBottom: 16 }}>
        <LigneReglage icone="globe" label={t("reglages_langue_devise", langue)} onPress={() => router.push("/reglages/langue-devise")} />
        <LigneReglage icone="bell" label={t("reglages_notifications", langue)} onPress={() => router.push("/reglages/notifications")} />
        <LigneReglage icone="file-text" label="Export comptable" onPress={() => router.push("/export")} />
        <LigneReglage icone="headphones" label={t("reglages_contact", langue)} onPress={() => router.push("/contact")} dernier />
      </Carte>

      {__DEV__ && (
        <>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 16, marginBottom: 8 }}>🧪 TEST — Forcer un plan</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
            {(["gratuit", "starter", "premium"] as const).map((p) => (
              <Pressable
                key={p}
                onPress={() => definirPlanTest(p)}
                style={{
                  flex: 1, paddingVertical: 8, borderRadius: 8,
                  borderWidth: planId === p ? 2 : 1,
                  borderColor: planId === p ? colors.accent : colors.border,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 11, color: planId === p ? colors.accent : colors.textPrimary }}>{p}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function SectionTitre({ titre }: { titre: string }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 8, textTransform: "uppercase" }}>{titre}</Text>;
}

function LigneReglage({ icone, label, dernier, onPress }: { icone: any; label: string; dernier?: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.ligneReglage, !dernier && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <View style={styles.ligneReglageGauche}>
        <Feather name={icone} size={16} color={colors.textSecondary} />
        <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{label}</Text>
      </View>
      <Feather name="chevron-right" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, paddingTop: 50 },
  ligneAbonnement: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  boutonPro: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  ligneOptions: { flexDirection: "row", gap: 8 },
  optionMode: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: "center" },
  ligneReglage: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  ligneReglageGauche: { flexDirection: "row", alignItems: "center", gap: 10 },
});