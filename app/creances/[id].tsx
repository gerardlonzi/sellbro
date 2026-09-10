import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { database } from "@/lib/database";
import { EnteteEcran, Carte, Badge } from "@/components/UI";

export default function DetailCreance() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { formater } = useCurrency();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [creance, setCreance] = useState<any>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    charger();
  }, [id]);

  async function charger() {
    setChargement(true);
    try {
      const c = await database.get("creances_dettes").find(id);
      setCreance(c);
    } catch {
      setCreance(null);
    }
    setChargement(false);
  }

  if (chargement) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!creance) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16, paddingTop: 50 }}>
        <EnteteEcran titre="—" onRetour={() => router.back()} />
      </View>
    );
  }

  const enRetard = creance.statut !== "payee" && creance.dateEcheance && new Date(creance.dateEcheance) < new Date();
  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString(langue === "fr" ? "fr-FR" : "en-US") : "—");

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <EnteteEcran titre={creance.personneNom ?? "—"} onRetour={() => router.back()} />

      <View style={{ alignItems: "center", marginBottom: 16 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "700" }}>{formater(creance.montantRestant)}</Text>
        <Badge
          texte={creance.statut === "payee" ? t("creances_payee", langue) : enRetard ? t("creances_en_retard", langue) : t("creances_statut_a_venir", langue)}
          type={creance.statut === "payee" ? "succes" : enRetard ? "danger" : "attention"}
        />
      </View>

      <Carte style={{ gap: 12 }}>
        <Ligne label={t("nouvelle_creance_telephone", langue)} valeur={creance.telephone ?? "—"} colors={colors} />
        <Ligne label={t("nouvelle_creance_montant", langue)} valeur={formater(creance.montantRestant)} colors={colors} />
        <Ligne label={t("creance_date_prise", langue)} valeur={fmtDate(creance.creeLe ? creance.creeLe.toISOString() : null)} colors={colors} />
        <Ligne label={t("nouvelle_creance_echeance", langue)} valeur={fmtDate(creance.dateEcheance)} colors={colors} />
        <Ligne label={t("nouvelle_creance_champ_produit", langue)} valeur={creance.produitConcerne ?? "—"} colors={colors} />
        <Ligne label={t("nouvelle_creance_champ_note", langue)} valeur={creance.note ?? "—"} colors={colors} dernier />
      </Carte>
    </ScrollView>
  );
}

function Ligne({ label, valeur, colors, dernier }: any) {
  return (
    <View style={[styles.ligne, !dernier && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{valeur}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 50 },
  ligne: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
});