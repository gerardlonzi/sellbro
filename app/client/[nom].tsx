import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { obtenirUserId } from "@/lib/auth/userCache";
import { EnteteEcran, Carte } from "@/components/UI";

type StatsClient = {
  telephone: string | null;
  nbAchats: number;
  total: number;
  produitPrefere: { nom: string; quantite: number } | null;
};

export default function FicheClient() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { formater } = useCurrency();
  const { nom } = useLocalSearchParams<{ nom: string }>();
  const [stats, setStats] = useState<StatsClient | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    charger();
  }, [nom]);

  async function charger() {
    setChargement(true);
    const userId = await obtenirUserId();
    if (!userId) { setChargement(false); return; }

    const ventes = await database.get("ventes").query(Q.where("user_id", userId)).fetch();
    const duClient = (ventes as any[]).filter((v) => v.clientNom === nom);

    let telephone: string | null = null;
    let total = 0;
    const parProduit: Record<string, number> = {};

    for (const v of duClient) {
      if (v.clientTelephone) telephone = v.clientTelephone;
      total += v.quantite * v.prixUnitaire;
      const nomProduit = v.produitNom ?? "—";
      parProduit[nomProduit] = (parProduit[nomProduit] ?? 0) + v.quantite;
    }

    const produitPrefere = Object.entries(parProduit)
      .map(([n, q]) => ({ nom: n, quantite: q }))
      .sort((a, b) => b.quantite - a.quantite)[0] ?? null;

    setStats({ telephone, nbAchats: duClient.length, total, produitPrefere });
    setChargement(false);
  }

  if (chargement) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <EnteteEcran titre={nom ?? ""} onRetour={() => router.back()} />

      <View style={[styles.avatar, { backgroundColor: colors.accentBg }]}>
        <Text style={{ color: colors.accent, fontSize: 22, fontWeight: "600" }}>{(nom ?? "?").slice(0, 2).toUpperCase()}</Text>
      </View>

      <Carte style={{ marginTop: 16, gap: 12 }}>
        <Ligne label={t("client_telephone", langue)} valeur={stats?.telephone ?? "—"} colors={colors} />
        <Ligne label={t("client_nb_achats", langue)} valeur={`${stats?.nbAchats ?? 0}`} colors={colors} />
        <Ligne label={t("client_total", langue)} valeur={formater(stats?.total ?? 0)} colors={colors} />
        <Ligne
          label={t("client_produit_prefere", langue)}
          valeur={stats?.produitPrefere ? `${stats.produitPrefere.nom} (×${stats.produitPrefere.quantite})` : "—"}
          colors={colors}
          dernier
        />
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
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  ligne: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
});