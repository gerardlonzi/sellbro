import { useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { obtenirUserId } from "@/lib/auth/userCache";
import { usePlanActuel } from "@/lib/plan/usePlanActuel";
import { PeriodeId, plageDates } from "@/lib/periode/periodes";
import { SelecteurPeriode } from "@/components/SelecteurPeriode";
import { Carte } from "@/components/UI";

type Stats = {
  ca: number;
  ventes: number;
  benefice: number;
  parPaiement: Record<string, number>;
  parCategorie: { nom: string; montant: number }[];
  topProduits: { nom: string; ventes: number; montant: number }[];
  topClients: { nom: string; montant: number }[];
};

const STATS_VIDES: Stats = { ca: 0, ventes: 0, benefice: 0, parPaiement: {}, parCategorie: [], topProduits: [], topClients: [] };

type Mouvement = { id: string; type: string; quantite: number; stockAvant: number; stockApres: number; nomProduit: string };

export default function Dashboard() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { formater } = useCurrency();
  const { plan } = usePlanActuel();
  const [periode, setPeriode] = useState<PeriodeId>("semaine");
  const [stats, setStats] = useState<Stats>(STATS_VIDES);
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [chargement, setChargement] = useState(true);

  useFocusEffect(
    useCallback(() => {
      calculerStats();
    }, [periode])
  );

  async function calculerStats() {
    setChargement(true);
    const { debut } = plageDates(periode);
    const userId = await obtenirUserId();
    if (!userId) { setChargement(false); return; }

    const tousLesVentes = await database.get("ventes").query(Q.where("user_id", userId)).fetch();
    const ventes = (tousLesVentes as any[]).filter((v) => v.creeLe >= debut);

    const tousLesProduits = await database.get("produits").query(Q.where("user_id", userId)).fetch();
    const produitsParId = new Map((tousLesProduits as any[]).map((p) => [p.id, p]));

    // Mouvements de stock : toujours chargés, indépendamment des ventes.
    const tousLesMouvements = await database
      .get("mouvements_stock")
      .query(Q.where("user_id", userId), Q.sortBy("cree_le", Q.desc))
      .fetch();
    setMouvements(
      (tousLesMouvements as any[]).slice(0, 10).map((m) => ({
        id: m.id,
        type: m.type,
        quantite: m.quantite,
        stockAvant: m.stockAvant,
        stockApres: m.stockApres,
        nomProduit: produitsParId.get(m.produitId)?.nom ?? "—",
      }))
    );

    if (ventes.length === 0) {
      setStats(STATS_VIDES);
      setChargement(false);
      return;
    }

    const ca = ventes.reduce((s, v) => s + v.quantite * v.prixUnitaire, 0);

    const parPaiement: Record<string, number> = {};
    const parCategorieMap: Record<string, number> = {};
    const parProduitMap: Record<string, { ventes: number; montant: number }> = {};
    const parClientMap: Record<string, number> = {};

    for (const v of ventes) {
      const montantLigne = v.quantite * v.prixUnitaire;
      const mode = v.modePaiement ?? "—";
      parPaiement[mode] = (parPaiement[mode] ?? 0) + montantLigne;

      const produit = v.produitId ? produitsParId.get(v.produitId) : null;
      const categorie = produit?.categorieNom ?? "Sans catégorie";
      parCategorieMap[categorie] = (parCategorieMap[categorie] ?? 0) + montantLigne;

      const nomProduit = v.produitNom ?? produit?.nom ?? "—";
      if (!parProduitMap[nomProduit]) parProduitMap[nomProduit] = { ventes: 0, montant: 0 };
      parProduitMap[nomProduit].ventes += v.quantite;
      parProduitMap[nomProduit].montant += montantLigne;

      if (v.clientNom) parClientMap[v.clientNom] = (parClientMap[v.clientNom] ?? 0) + montantLigne;
    }

    const parCategorie = Object.entries(parCategorieMap).map(([nom, montant]) => ({ nom, montant })).sort((a, b) => b.montant - a.montant);
    const topProduits = Object.entries(parProduitMap).map(([nom, d]) => ({ nom, ...d })).sort((a, b) => b.montant - a.montant).slice(0, 5);
    const topClients = Object.entries(parClientMap).map(([nom, montant]) => ({ nom, montant })).sort((a, b) => b.montant - a.montant).slice(0, 5);

    setStats({ ca, ventes: ventes.length, benefice: Math.round(ca * 0.3), parPaiement, parCategorie, topProduits, topClients });
    setChargement(false);
  }

  const maxCategorie = Math.max(1, ...stats.parCategorie.map((c) => c.montant));

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View style={styles.entete}>
        <Text style={{ fontSize: 16, fontWeight: "500", color: colors.textPrimary }}>{t("dashboard_titre", langue)}</Text>
        {plan?.exportComptable && (
          <Pressable onPress={() => router.push("/export")} style={[styles.boutonExport, { borderColor: colors.border }]}>
            <Feather name="download" size={14} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <SelecteurPeriode periode={periode} onChange={setPeriode} plan={plan} />

      {chargement ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={colors.accent} />
      ) : (
        <>
          <View style={styles.ligneDeuxCartes}>
            <Carte style={{ flex: 1 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{t("dashboard_ca", langue)}</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "500", marginTop: 4 }}>{formater(stats.ca)}</Text>
            </Carte>
            <Carte style={{ flex: 1 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{t("dashboard_benefice", langue)}</Text>
              <Text style={{ color: colors.success, fontSize: 17, fontWeight: "500", marginTop: 4 }}>{formater(stats.benefice)}</Text>
            </Carte>
          </View>

          <Carte style={{ marginTop: 12 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t("dashboard_ventes", langue)}</Text>
            <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "500", marginTop: 4 }}>{stats.ventes}</Text>
          </Carte>

          {/* Répartition par catégorie */}
          {stats.parCategorie.length > 0 && (
            <Carte style={{ marginTop: 12 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500", marginBottom: 12 }}>Par catégorie</Text>
              {stats.parCategorie.map((c) => (
                <View key={c.nom} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: colors.textPrimary }}>{c.nom}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{formater(c.montant)}</Text>
                  </View>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: "hidden" }}>
                    <View style={{ width: `${(c.montant / maxCategorie) * 100}%`, height: "100%", backgroundColor: colors.accent }} />
                  </View>
                </View>
              ))}
            </Carte>
          )}

          {/* Top produits */}
          <Carte style={{ marginTop: 12 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500", marginBottom: 10 }}>Produits les plus vendus</Text>
            {stats.topProduits.map((p, i) => (
              <View key={p.nom} style={[styles.ligneTop, i < stats.topProduits.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <Text style={{ fontSize: 12, color: colors.textPrimary, flex: 1 }}>{p.nom}</Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginRight: 10 }}>{p.ventes} ventes</Text>
                <Text style={{ fontSize: 12, fontWeight: "500", color: colors.textPrimary }}>{formater(p.montant)}</Text>
              </View>
            ))}
          </Carte>

          {/* Top clients */}
          {stats.topClients.length > 0 && (
            <Carte style={{ marginTop: 12 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500", marginBottom: 10 }}>Meilleurs clients</Text>
              {stats.topClients.map((c, i) => (
                <View key={c.nom} style={[styles.ligneTop, i < stats.topClients.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <Text style={{ fontSize: 12, color: colors.textPrimary, flex: 1 }}>{c.nom}</Text>
                  <Text style={{ fontSize: 12, fontWeight: "500", color: colors.textPrimary }}>{formater(c.montant)}</Text>
                </View>
              ))}
            </Carte>
          )}

          {/* Par mode de paiement */}
          {Object.keys(stats.parPaiement).length > 0 && (
            <Carte style={{ marginTop: 12 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500", marginBottom: 10 }}>{t("dashboard_par_paiement", langue)}</Text>
              {Object.entries(stats.parPaiement).map(([mode, montant]) => (
                <View key={mode} style={styles.lignePaiement}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{mode}</Text>
                  <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "500" }}>{formater(montant)}</Text>
                </View>
              ))}
            </Carte>
          )}

          {/* Mouvements de stock */}
          <Carte style={{ marginTop: 12, marginBottom: 20 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500", marginBottom: 10 }}>Mouvements de stock</Text>
            {mouvements.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Aucun mouvement</Text>
            ) : (
              mouvements.map((m, i) => (
                <View key={m.id} style={[styles.ligneTop, i < mouvements.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <Text style={{ fontSize: 12, color: colors.textPrimary, flex: 1 }}>{m.nomProduit}</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginRight: 10 }}>{m.type} {m.quantite > 0 ? "+" : ""}{m.quantite}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>{m.stockAvant} → {m.stockApres}</Text>
                </View>
              ))
            )}
          </Carte>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, paddingTop: 50 },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  boutonExport: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  ligneDeuxCartes: { flexDirection: "row", gap: 10 },
  etatVide: { alignItems: "center", paddingTop: 40 },
  ligneTop: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  lignePaiement: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
});