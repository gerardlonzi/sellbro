import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Share } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { EnteteEcran, Badge } from "@/components/UI";

export default function DetailFacture() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { formater } = useCurrency();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [facture, setFacture] = useState<any>(null);
  const [lignes, setLignes] = useState<any[]>([]);
  const [chargement, setChargement] = useState(true);

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
    await database.write(async () => {
      await facture.update((f: any) => {
        f.statut = "payee";
        f.montantPaye = f.total;
      });
    });
    charger();
  }

  async function partager() {
    const texte = `${t("facture_numero", langue)} ${facture.numero}\n${lignes.map((l) => `${l.produitNom} x${l.quantite} — ${(l.quantite * l.prixUnitaire).toLocaleString()} F`).join("\n")}\n\n${t("facture_total", langue)}: ${formater(facture.total)}`;
    await Share.share({ message: texte });
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
          <Pressable onPress={marquerPayee} style={[styles.bouton, { backgroundColor: colors.success }]}>
            <Feather name="check" size={15} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>{t("facture_marquer_payee", langue)}</Text>
          </Pressable>
        )}
        <Pressable onPress={partager} style={[styles.bouton, { borderColor: colors.border, borderWidth: 1 }]}>
          <Feather name="share-2" size={15} color={colors.textPrimary} />
          <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{t("facture_partager", langue)}</Text>
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
});