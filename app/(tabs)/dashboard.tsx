import { useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { obtenirUserId } from "@/lib/auth/userCache";
import { usePlanActuel } from "@/lib/plan/usePlanActuel";
import { PeriodeId, plageDates, plagePrecedente } from "@/lib/periode/periodes";
import { SelecteurPeriode } from "@/components/SelecteurPeriode";
import { Carte, Skeleton } from "@/components/UI";
import DateTimePicker from "@react-native-community/datetimepicker";

type Stats = {
  ca: number;
  ventes: number;
  benefice: number;
  parPaiement: Record<string, number>;
  parCategorie: { nom: string; montant: number }[];
  topProduits: { nom: string; ventes: number; montant: number }[];
  topRevenus: { nom: string; montant: number; ventes: number }[];
  topClients: { nom: string; montant: number }[];
};

const STATS_VIDES: Stats = { ca: 0, ventes: 0, benefice: 0, parPaiement: {}, parCategorie: [], topProduits: [], topRevenus: [], topClients: [] };

// Valeurs de la période précédente, pour les flèches de tendance.
type Tendance = { ca: number; ventes: number; benefice: number };
const TENDANCE_VIDE: Tendance = { ca: 0, ventes: 0, benefice: 0 };

type Mouvement = { id: string; type: string; quantite: number; stockAvant: number; stockApres: number; nomProduit: string };

function Fleche({ actuel, precedent }: { actuel: number; precedent: number }) {
  const { colors } = useTheme();
  if (actuel > precedent) return <Feather name="trending-up" size={13} color={colors.success} />;
  if (actuel < precedent) return <Feather name="trending-down" size={13} color={colors.danger} />;
  return <Feather name="minus" size={13} color={colors.textMuted} />;
}

const MEDAILLES = ["🥇", "🥈", "🥉"];

function Medaille({ rang }: { rang: number }) {
  if (rang < 3) return <Text style={{ fontSize: 14, marginRight: 6 }}>{MEDAILLES[rang]}</Text>;
  return null;
}

export default function Dashboard() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { showToast } = useToast();
  const { formater } = useCurrency();
  const { plan } = usePlanActuel();
  const [periode, setPeriode] = useState<PeriodeId>("semaine");
  const [stats, setStats] = useState<Stats>(STATS_VIDES);
  const [precedente, setPrecedente] = useState<Tendance>(TENDANCE_VIDE);
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [ruptures, setRuptures] = useState(0);
  const [alertes, setAlertes] = useState(0);
  const [personnalise, setPersonnalise] = useState(false);
  const [debutPerso, setDebutPerso] = useState(new Date());
  const [finPerso, setFinPerso] = useState(new Date());
  const [afficherDatePicker, setAfficherDatePicker] = useState<"debut" | "fin" | null>(null);
  const [chargement, setChargement] = useState(true);

  useFocusEffect(
    useCallback(() => {
      calculerStats();
    }, [periode, personnalise, debutPerso, finPerso])
  );

  async function calculerStats() {
    setChargement(true);
    const debut = personnalise ? debutPerso : plageDates(periode).debut;
    const fin = personnalise ? finPerso : new Date();
    const userId = await obtenirUserId();
    if (!userId) { setChargement(false); return; }

    const tousLesVentes = await database.get("ventes").query(Q.where("user_id", userId)).fetch();
    const ventes = (tousLesVentes as any[]).filter((v) => v.creeLe >= debut && v.creeLe <= fin);

    // Période précédente (pour les flèches de tendance). Calculée sur les mêmes
    // données déjà chargées, donc sans requête supplémentaire.
    let precCa = 0, precVentes = 0, precBenefice = 0;
    if (!personnalise) {
      const prec = plagePrecedente(periode);
      const ventesPrec = (tousLesVentes as any[]).filter((v) => v.creeLe >= prec.debut && v.creeLe < prec.fin);
      precCa = ventesPrec.reduce((s, v) => s + v.quantite * v.prixUnitaire, 0);
      precVentes = ventesPrec.length;
      precBenefice = Math.round(precCa * 0.3);
    }
    setPrecedente({ ca: precCa, ventes: precVentes, benefice: precBenefice });

    const tousLesProduits = await database.get("produits").query(Q.where("user_id", userId)).fetch();
    const produitsParId = new Map((tousLesProduits as any[]).map((p) => [p.id, p]));
    setRuptures((tousLesProduits as any[]).filter((p) => p.quantiteStock === 0).length);
    setAlertes((tousLesProduits as any[]).filter((p) => p.quantiteStock > 0 && p.quantiteStock <= p.seuilAlerte).length);

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
    const topProduits = Object.entries(parProduitMap).map(([nom, d]) => ({ nom, ...d })).sort((a, b) => b.ventes - a.ventes || b.montant - a.montant).slice(0, 5);
    const topRevenus = Object.entries(parProduitMap).map(([nom, d]) => ({ nom, ...d })).sort((a, b) => b.montant - a.montant).slice(0, 5);
    const topClients = Object.entries(parClientMap).map(([nom, montant]) => ({ nom, montant })).sort((a, b) => b.montant - a.montant).slice(0, 5);

    setStats({ ca, ventes: ventes.length, benefice: Math.round(ca * 0.3), parPaiement, parCategorie, topProduits, topRevenus, topClients });
    setChargement(false);
  }

  const maxCategorie = Math.max(1, ...stats.parCategorie.map((c) => c.montant));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <View style={styles.entete}>
        <Text style={{ fontSize: 16, fontWeight: "500", color: colors.textPrimary }}>{t("dashboard_titre", langue)}</Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Pressable
            onPress={() => {
              if (plan && plan.rapportsMax !== "annee") {
                showToast(t("dashboard_intervalle_perso_reserve", langue), "info");
                return;
              }
              setPersonnalise(!personnalise);
            }}
            style={[styles.boutonPersonnalise, { borderColor: personnalise ? colors.accent : colors.border, borderWidth: personnalise ? 1.5 : 1 }]}
          >
            <Feather name="calendar" size={14} color={personnalise ? colors.accent : colors.textSecondary} />
            <Text style={{ color: personnalise ? colors.accent : colors.textSecondary, fontSize: 12 }}>Personnalisé</Text>
          </Pressable>

          {plan?.exportComptable && (
            <Pressable onPress={() => router.push("/export")} style={[styles.boutonExport, { borderColor: colors.border }]}>
              <Feather name="download" size={14} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>
      


      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View>
        <SelecteurPeriode periode={periode} onChange={setPeriode} plan={plan} />


        {personnalise && (
          <View style={styles.blocPersonnalise}>
            <Pressable onPress={() => setAfficherDatePicker("debut")} style={[styles.champDate, { borderColor: colors.border }]}>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Du</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{debutPerso.toLocaleDateString(langue === "fr" ? "fr-FR" : "en-US")}</Text>
            </Pressable>
            <Pressable onPress={() => setAfficherDatePicker("fin")} style={[styles.champDate, { borderColor: colors.border }]}>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Au</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{finPerso.toLocaleDateString(langue === "fr" ? "fr-FR" : "en-US")}</Text>
            </Pressable>
          </View>
        )}

        {afficherDatePicker && (
          <DateTimePicker
            value={afficherDatePicker === "debut" ? debutPerso : finPerso}
            mode="date"
            onChange={(event: any, date?: Date) => {
              setAfficherDatePicker(null);
              if (event.type === "set" && date) {
                if (afficherDatePicker === "debut") setDebutPerso(date);
                else setFinPerso(date);
              }
            }}
          />
        )}
      </View>


        {chargement ? (
          <View style={{ marginTop: 12, gap: 12 }}>
            <View style={styles.ligneDeuxCartes}>
              <Carte style={{ flex: 1, gap: 8 }}>
                <Skeleton width="55%" height={11} />
                <Skeleton width="70%" height={20} />
              </Carte>
              <Carte style={{ flex: 1, gap: 8 }}>
                <Skeleton width="55%" height={11} />
                <Skeleton width="70%" height={20} />
              </Carte>
            </View>
            <Carte style={{ gap: 8 }}>
              <Skeleton width="45%" height={12} />
              <Skeleton width="30%" height={24} />
            </Carte>
            <Carte style={{ gap: 10 }}>
              <Skeleton width="40%" height={13} />
              <Skeleton width="100%" height={12} />
              <Skeleton width="88%" height={12} />
              <Skeleton width="94%" height={12} />
            </Carte>
          </View>
        ) : (
          <>
            <View style={styles.ligneDeuxCartes}>
              <Carte style={{ flex: 1 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{t("dashboard_ca", langue)}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "500" }}>{formater(stats.ca)}</Text>
                  <Fleche actuel={stats.ca} precedent={precedente.ca} />
                </View>
              </Carte>
              <Carte style={{ flex: 1 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{t("dashboard_benefice", langue)}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <Text style={{ color: colors.success, fontSize: 17, fontWeight: "500" }}>{formater(stats.benefice)}</Text>
                  <Fleche actuel={stats.benefice} precedent={precedente.benefice} />
                </View>
              </Carte>
            </View>

            <Carte style={{ marginTop: 12 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t("dashboard_ventes", langue)}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "500" }}>{stats.ventes}</Text>
                <Fleche actuel={stats.ventes} precedent={precedente.ventes} />
              </View>
            </Carte>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Pressable onPress={() => router.push({ pathname: "/stock", params: { statut: "rupture" } })} style={{ flex: 1 }}>
                <Carte style={{ backgroundColor: ruptures > 0 ? colors.dangerBg : colors.surface }}>
                  <View style={{ alignItems: "center", gap: 4 }}>
                    <Text style={{ color: ruptures > 0 ? colors.danger : colors.textSecondary, fontSize: 22, fontWeight: "700" }}>{ruptures}</Text>
                    <Text style={{ color: ruptures > 0 ? colors.danger : colors.textSecondary, fontSize: 11, textAlign: "center" }}>
                      {t("stock_statut_rupture", langue)}
                    </Text>
                  </View>
                </Carte>
              </Pressable>
              <Pressable onPress={() => router.push({ pathname: "/stock", params: { statut: "faible" } })} style={{ flex: 1 }}>
                <Carte style={{ backgroundColor: alertes > 0 ? colors.warningBg : colors.surface }}>
                  <View style={{ alignItems: "center", gap: 4 }}>
                    <Text style={{ color: alertes > 0 ? colors.warning : colors.textSecondary, fontSize: 22, fontWeight: "700" }}>{alertes}</Text>
                    <Text style={{ color: alertes > 0 ? colors.warning : colors.textSecondary, fontSize: 11, textAlign: "center" }}>
                      {t("stock_statut_faible", langue)}
                    </Text>
                  </View>
                </Carte>
              </Pressable>
            </View>

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
                  <Medaille rang={i} />
                  <Text style={{ fontSize: 12, color: colors.textPrimary, flex: 1 }}>{p.nom}</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginRight: 10 }}>{p.ventes} ventes</Text>
                  <Text style={{ fontSize: 12, fontWeight: "500", color: colors.textPrimary }}>{formater(p.montant)}</Text>
                </View>
              ))}
            </Carte>

            {/* Produits générant le plus de revenus */}
            {stats.topRevenus.length > 0 && (
              <Carte style={{ marginTop: 12 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500", marginBottom: 10 }}>Produits générant le plus de revenus</Text>
                {stats.topRevenus.map((p, i) => (
                  <View key={p.nom} style={[styles.ligneTop, i < stats.topRevenus.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                    <Medaille rang={i} />
                    <Text style={{ fontSize: 12, color: colors.textPrimary, flex: 1 }}>{p.nom}</Text>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.accent }}>{formater(p.montant)}</Text>
                  </View>
                ))}
              </Carte>
            )}

            {/* Top clients */}
            {stats.topClients.length > 0 && (
              <Carte style={{ marginTop: 12 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500", marginBottom: 10 }}>Meilleurs clients</Text>
                {stats.topClients.map((c, i) => (
                  <View key={c.nom} style={[styles.ligneTop, i < stats.topClients.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                    <View style={[styles.avatar, { backgroundColor: i === 0 ? colors.accent : colors.accentBg }]}>
                      <Text style={{ color: i === 0 ? "#fff" : colors.accent, fontSize: 11, fontWeight: "600" }}>{c.nom.slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textPrimary, flex: 1 }}>{c.nom}</Text>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.accent }}>{formater(c.montant)}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 15 },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  boutonExport: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  boutonPersonnalise: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 5 },
  blocPersonnalise: { flexDirection: "row", gap: 10, marginTop: 2, marginBottom: 8 },
  champDate: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  ligneDeuxCartes: { flexDirection: "row", gap: 10 },
  etatVide: { alignItems: "center", paddingTop: 40 },
  ligneTop: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", marginRight: 10 },
  lignePaiement: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
});