import { useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, Share } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { PeriodeId, plageDates } from "@/lib/periode/periodes";
import { SelecteurPeriode } from "@/components/SelecteurPeriode";
import { usePlanActuel } from "@/lib/plan/usePlanActuel";
import { EnteteEcran, Skeleton } from "@/components/UI";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { obtenirUserId } from "@/lib/auth/userCache";
import { genererExportPdf, obtenirInfosBoutique } from "@/lib/export/genererPdf";

type StatsExport = {
  ca: number; benefice: number; ventes: number; parPaiement: Record<string, number>;
  produitsEnStock: number; ruptures: number;
  topProduits: { nom: string; ventes: number; montant: number }[];
  topClients: { nom: string; montant: number }[];
};

export default function Export() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { formater } = useCurrency();
  const { plan } = usePlanActuel();
  const [periode, setPeriode] = useState<PeriodeId>("mois");
  const [format, setFormat] = useState<"pdf" | "excel">("pdf");
  const [stats, setStats] = useState<StatsExport>({ ca: 0, benefice: 0, ventes: 0, parPaiement: {}, produitsEnStock: 0, ruptures: 0, topProduits: [], topClients: [] });
  const [chargement, setChargement] = useState(false);
  const [chargementStats, setChargementStats] = useState(true);

  useFocusEffect(
    useCallback(() => {
      calculerStats();
    }, [periode])
  );

  async function calculerStats() {
    setChargementStats(true);
    const { debut } = plageDates(periode);
    const userId = await obtenirUserId();
    if (!userId) { setChargementStats(false); return; }

    const tousLesVentes = await database.get("ventes").query(Q.where("user_id", userId)).fetch();
    const ventes = (tousLesVentes as any[]).filter((v) => v.creeLe >= debut);
    const ca = ventes.reduce((s, v) => s + v.quantite * v.prixUnitaire, 0);

    const parPaiement: Record<string, number> = {};
    const parProduit: Record<string, { ventes: number; montant: number }> = {};
    const parClient: Record<string, number> = {};
    for (const v of ventes) {
      const mode = v.modePaiement ?? "—";
      parPaiement[mode] = (parPaiement[mode] ?? 0) + v.quantite * v.prixUnitaire;
      const nomProduit = v.produitNom ?? "—";
      if (!parProduit[nomProduit]) parProduit[nomProduit] = { ventes: 0, montant: 0 };
      parProduit[nomProduit].ventes += v.quantite;
      parProduit[nomProduit].montant += v.quantite * v.prixUnitaire;
      if (v.clientNom) parClient[v.clientNom] = (parClient[v.clientNom] ?? 0) + v.quantite * v.prixUnitaire;
    }

    const tousLesProduits = await database.get("produits").query(Q.where("user_id", userId)).fetch();
    const produitsEnStock = (tousLesProduits as any[]).length;
    const ruptures = (tousLesProduits as any[]).filter((p) => p.quantiteStock === 0).length;
    const topProduits = Object.entries(parProduit).map(([nom, d]) => ({ nom, ...d })).sort((a, b) => b.ventes - a.ventes || b.montant - a.montant).slice(0, 5);
    const topClients = Object.entries(parClient).map(([nom, montant]) => ({ nom, montant })).sort((a, b) => b.montant - a.montant).slice(0, 5);

    setStats({ ca, benefice: Math.round(ca * 0.3), ventes: ventes.length, parPaiement, produitsEnStock, ruptures, topProduits, topClients });
    setChargementStats(false);
  }

  async function generer() {
    setChargement(true);
    const periodeLabel = t(`periode_${periode}` as any, langue) as string;

    if (format === "pdf") {
      await genererExportPdf(stats, periodeLabel);
    } else {
      const infos = await obtenirInfosBoutique();
      const paiements = Object.entries(stats.parPaiement).map(([mode, montant]) => `${mode};${montant}`).join("\n");
      const csv = [
        `Boutique;${infos.nom}`,
        `Période;${periodeLabel}`,
        `Chiffre d'affaires;${stats.ca}`,
        `Bénéfice estimé;${stats.benefice}`,
        `Nombre de ventes;${stats.ventes}`,
        `Mode;Montant`,
        paiements,
      ].join("\n");
      await Share.share({ message: csv, title: "Export comptable CSV" });
    }
    setChargement(false);
  }

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
          <Text style={{ color: format === "excel" ? colors.accent : colors.textPrimary, fontSize: 13 }}>CSV</Text>
        </Pressable>
      </View>

      <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ fontSize: 12, fontWeight: "500", color: colors.textPrimary, marginBottom: 10 }}>Aperçu</Text>
        {chargementStats ? (
          <View style={{ gap: 12 }}>
            <Skeleton width="70%" height={14} />
            <Skeleton width="60%" height={14} />
            <Skeleton width="45%" height={14} />
          </View>
        ) : (
          <>
            <Ligne label={t("dashboard_ca", langue)} valeur={formater(stats.ca)} colors={colors} />
            <Ligne label={t("dashboard_benefice", langue)} valeur={formater(stats.benefice)} colors={colors} />
            <Ligne label={t("dashboard_ventes", langue)} valeur={String(stats.ventes)} colors={colors} />
            <Ligne label={t("export_produits_stock", langue)} valeur={String(stats.produitsEnStock)} colors={colors} />
            <Ligne label={t("export_ruptures", langue)} valeur={String(stats.ruptures)} colors={colors} dernier />
          </>
        )}
      </View>

      <Pressable
        style={[styles.boutonGenerer, { backgroundColor: colors.accent, marginTop: 20, opacity: chargement ? 0.6 : 1 }]}
        onPress={generer}
        disabled={chargement}
      >
        <Feather name="share" size={15} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{chargement ? "..." : "Générer et partager"}</Text>
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