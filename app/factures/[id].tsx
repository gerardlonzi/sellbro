import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { peutEcrire } from "@/lib/trial/gate";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { EnteteEcran, Badge } from "@/components/UI";
import { genererFacturePdf } from "@/lib/export/genererPdf";

export default function DetailFacture() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { showToast } = useToast();
  const { formater } = useCurrency();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [facture, setFacture] = useState<any>(null);
  const [lignes, setLignes] = useState<any[]>([]);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    charger();
  }, [id]);

  async function charger() {
    setChargement(true);
    const f = await database.get("factures" as any).find(id);
    const l = await database.get("facture_lignes" as any).query(Q.where("facture_id", id)).fetch();
    setFacture(f);
    setLignes(l as any[]);
    setChargement(false);
  }

  async function marquerPayee() {
    if (enregistrement) return;
    if (!(await peutEcrire())) { showToast(t("essai_expire", langue), "error"); return; }
    setEnregistrement(true);
    try {
      await database.write(async () => {
        await facture.update((f: any) => {
          f.statut = "payee";
          f.montantPaye = f.total;
        });
      });
      charger();
    } finally {
      setEnregistrement(false);
    }
  }

  async function imprimer() {
    await genererFacturePdf(facture, lignes, langue, false);
  }

  async function exporter() {
    await genererFacturePdf(facture, lignes, langue, true);
  }

  if (chargement || !facture) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <EnteteEcran titre={facture.numero} onRetour={() => router.back()} />

      <View style={{ alignItems: "center", marginBottom: 16 }}>
        <Badge texte={t(`facture_statut_${facture.statut}` as any, langue)} type={facture.statut === "payee" ? "succes" : "attention"} />
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 8 }}>{facture.clientNom ?? "—"}</Text>
      </View>

      <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {lignes.map((l) => (
          <View key={l.id} style={styles.ligneFacture}>
            <Text style={{ color: colors.textPrimary, fontSize: 13, flex: 1 }}>{l.produitNom} x{l.quantite}</Text>
            <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{(l.quantite * l.prixUnitaire).toLocaleString()} F</Text>
          </View>
        ))}
        <View style={[styles.ligneFacture, { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 10 }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t("facture_sous_total", langue)}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{formater(facture.sousTotal)}</Text>
        </View>
        <View style={styles.ligneFacture}>
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "600" }}>{t("facture_total", langue)}</Text>
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "600" }}>{formater(facture.total)}</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
        {facture.statut !== "payee" && (
          <Pressable onPress={marquerPayee} disabled={enregistrement} style={[styles.bouton, { backgroundColor: colors.success, opacity: enregistrement ? 0.6 : 1 }]}>
            <Feather name="check" size={15} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>{t("facture_marquer_payee", langue)}</Text>
          </Pressable>
        )}
        <Pressable onPress={imprimer} style={[styles.bouton, { backgroundColor: colors.accent }]}>
          <Feather name="printer" size={15} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>{t("vente_imprimer", langue)}</Text>
        </Pressable>
        <Pressable onPress={exporter} style={[styles.boutonExport, { borderColor: colors.border, borderWidth: 1 }]}>
          <Feather name="download" size={15} color={colors.textPrimary} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 50 },
  carte: { borderWidth: 1, borderRadius: 12, padding: 16 },
  ligneFacture: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  bouton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 10 },
  boutonExport: { gap: 6, paddingVertical: 12, borderRadius: 10, paddingHorizontal:15 },
});