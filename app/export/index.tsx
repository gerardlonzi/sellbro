import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { PeriodeId } from "@/lib/periode/periodes";
import { SelecteurPeriode } from "@/components/SelecteurPeriode";
import { usePlanActuel } from "@/lib/plan/usePlanActuel";
import { EnteteEcran } from "@/components/UI";

export default function Export() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { formater } = useCurrency();
  const { plan } = usePlanActuel();
  const [periode, setPeriode] = useState<PeriodeId>("mois");
  const [format, setFormat] = useState<"pdf" | "excel">("pdf");

  // L'export comptable est réservé à Starter/Premium (plan.exportComptable
  // vient directement de la table `plans`, modifiable sans toucher au code).
  if (plan && !plan.exportComptable) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16, paddingTop: 50 }}>
        <EnteteEcran titre="Export comptable" onRetour={() => router.back()} />
        <View style={{ alignItems: "center", marginTop: 60, paddingHorizontal: 20 }}>
          <View style={[styles.iconeVerrou, { backgroundColor: colors.proBg }]}>
            <Feather name="lock" size={22} color={colors.pro} />
          </View>
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textPrimary, marginTop: 14, textAlign: "center" }}>
            {t("limite_titre_fonctionnalite", langue)}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: "center", marginTop: 6, marginBottom: 20 }}>
            {t("limite_texte_fonctionnalite", langue)}
          </Text>
          <Pressable onPress={() => router.push("/premium")} style={[styles.boutonGenerer, { backgroundColor: colors.proFill }]}>
            <Text style={{ color: colors.onPro, fontSize: 14, fontWeight: "600" }}>{t("limite_bouton_forfaits", langue)}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16, paddingTop: 50 }}>
      <EnteteEcran titre="Export comptable" onRetour={() => router.back()} />

      <SelecteurPeriode periode={periode} onChange={setPeriode} plan={plan} />

      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8, marginTop: 8 }}>Format</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
        <Pressable
          onPress={() => setFormat("pdf")}
          style={[styles.choix, { borderColor: format === "pdf" ? colors.accent : colors.border, borderWidth: format === "pdf" ? 2 : 1 }]}
        >
          <Feather name="file-text" size={14} color={format === "pdf" ? colors.accent : colors.textPrimary} />
          <Text style={{ color: format === "pdf" ? colors.accent : colors.textPrimary, fontSize: 13 }}>PDF</Text>
        </Pressable>
        <Pressable
          onPress={() => setFormat("excel")}
          style={[styles.choix, { borderColor: format === "excel" ? colors.accent : colors.border, borderWidth: format === "excel" ? 2 : 1 }]}
        >
          <Feather name="grid" size={14} color={format === "excel" ? colors.accent : colors.textPrimary} />
          <Text style={{ color: format === "excel" ? colors.accent : colors.textPrimary, fontSize: 13 }}>Excel</Text>
        </Pressable>
      </View>

      <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ fontSize: 12, fontWeight: "500", color: colors.textPrimary, marginBottom: 10 }}>Aperçu</Text>
        {/* TODO : brancher les vraies données une fois les requêtes de stats centralisées */}
        <Ligne label={t("dashboard_ca", langue)} valeur={formater(0)} colors={colors} />
        <Ligne label={t("dashboard_benefice", langue)} valeur={formater(0)} colors={colors} />
        <Ligne label={t("dashboard_ventes", langue)} valeur="0" colors={colors} dernier />
      </View>

      <Pressable style={[styles.boutonGenerer, { backgroundColor: colors.accent, marginTop: 20 }]} onPress={() => {}}>
        <Feather name="share" size={15} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>Générer et partager</Text>
      </Pressable>
    </View>
  );
}

function Ligne({ label, valeur, colors, dernier }: any) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: dernier ? 0 : 1, borderBottomColor: colors.border }}>
      <Text style={{ fontSize: 12, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: "500", color: colors.textPrimary }}>{valeur}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  choix: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 8 },
  carte: { borderWidth: 1, borderRadius: 12, padding: 16 },
  boutonGenerer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 10 },
  iconeVerrou: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});