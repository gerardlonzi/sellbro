import { useState, useCallback, useEffect } from "react";
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
import { useEssai } from "@/lib/trial/useEssai";
import { afficherPaywall } from "@/lib/trial/paywall";
import { PeriodeId, plageDates, plagePrecedente } from "@/lib/periode/periodes";
import { PLANS_PAR_DEFAUT } from "@/lib/plan/quotas";
import { calculerBenefice } from "@/lib/ventes/benefice";
import { SelecteurPeriode } from "@/components/SelecteurPeriode";
import { Carte, Skeleton, Badge } from "@/components/UI";
import { BoutonRapport } from "@/components/BoutonRapport";
import { useToast } from "@/lib/toast/ToastProvider";
import { genererRapportPdf, SectionRapport } from "@/lib/export/genererPdf";
import { formaterDate } from "@/lib/formatDate";
import DateTimePicker from "@react-native-community/datetimepicker";

type Stats = {
  ca: number;
  ventes: number;
  produitsVendus: number;
  benefice: number;
  depenses: number;
  achats: number;
  parPaiement: Record<string, number>;
  parCategorie: { nom: string; montant: number }[];
  topProduits: { nom: string; ventes: number; montant: number }[];
  topRevenus: { nom: string; montant: number; ventes: number }[];
  topClients: { nom: string; montant: number }[];
  // Liste brute des ventes de la période, pour le rapport téléchargeable.
  ventesListe: { date: Date; produit: string; client: string; quantite: number; montant: number; paiement: string }[];
};

const STATS_VIDES: Stats = { ca: 0, ventes: 0, produitsVendus: 0, benefice: 0, depenses: 0, achats: 0, parPaiement: {}, parCategorie: [], topProduits: [], topRevenus: [], topClients: [], ventesListe: [] };

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
  const { formater } = useCurrency();
  const { plan, planId } = usePlanActuel();
  const essai = useEssai();
  // Plan « effectif » : pendant l'essai (TRIAL) ou en PRO, l'utilisateur a un
  // accès complet aux périodes (rapportsMax = annee). En FREE, on applique le plan réel.
  // Base = plan réel, ou le plan gratuit par défaut si le plan n'est pas encore
  // chargé (hors ligne / premier lancement) — sinon `undefined` verrouillait
  // mois/semestre/année avec paywall même pendant l'essai.
  const planEffectif =
    essai.statut !== "FREE"
      ? { ...(plan ?? PLANS_PAR_DEFAUT.gratuit), rapportsMax: "annee" as const }
      : plan;
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
  const [generationRapport, setGenerationRapport] = useState(false);
  const { showToast } = useToast();
  const {pret: planPret } = usePlanActuel();
  const estPremium = planId === "premium";



  // Si l'essai expire (passage en « free mode »), on réinitialise le filtre
  // personnalisé pour masquer les cartes de dates.
  useEffect(() => {
    // `verifie` est indispensable ici : tant qu'on ignore le statut, `actif`
    // vaut false et le filtre personnalisé serait remis à zéro à tort.
    if (essai.verifie && !essai.estPremium && !essai.actif) {
      setPersonnalise(false);
      setAfficherDatePicker(null);
    }
  }, [essai.verifie, essai.estPremium, essai.actif]);

  useFocusEffect(
    useCallback(() => {
      calculerStats();
    }, [periode, personnalise, debutPerso, finPerso])
  );

  async function calculerStats() {
    setChargement(true);
    // Bornes du filtre personnalisé : la date de début à minuit, la date de fin
    // à 23:59:59 (sinon un filtre « du 11 au 11 » exclut toute la journée du 11).
    const debut = personnalise
      ? new Date(debutPerso.getFullYear(), debutPerso.getMonth(), debutPerso.getDate(), 0, 0, 0, 0)
      : plageDates(periode).debut;
    const fin = personnalise
      ? new Date(finPerso.getFullYear(), finPerso.getMonth(), finPerso.getDate(), 23, 59, 59, 999)
      : new Date();
    const userId = await obtenirUserId();
    if (!userId) { setChargement(false); return; }

    const tousLesVentes = await database.get("ventes").query(Q.where("user_id", userId)).fetch();
    const ventes = (tousLesVentes as any[]).filter((v) => v.creeLe >= debut && v.creeLe <= fin);

    // Produits chargés AVANT les bénéfices : le calcul réel a besoin du prix d'achat.
    const tousLesProduits = await database.get("produits").query(Q.where("user_id", userId)).fetch();
    const produitsParId = new Map((tousLesProduits as any[]).map((p) => [p.id, p]));

    // Période précédente (pour les flèches de tendance). Calculée sur les mêmes
    // données déjà chargées, donc sans requête supplémentaire.
    let precCa = 0, precVentes = 0, precBenefice = 0;
    if (!personnalise) {
      const prec = plagePrecedente(periode);
      const ventesPrec = (tousLesVentes as any[]).filter((v) => v.creeLe >= prec.debut && v.creeLe < prec.fin);
      precCa = ventesPrec.reduce((s, v) => s + v.quantite * v.prixUnitaire, 0);
      precVentes = ventesPrec.length;
      precBenefice = calculerBenefice(ventesPrec, produitsParId);
    }
    setPrecedente({ ca: precCa, ventes: precVentes, benefice: precBenefice });

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

    // Dépenses et achats de la période : même filtre de dates que les ventes.
    // Chargés AVANT le cas « 0 vente » : le dashboard doit montrer les dépenses
    // même sans vente sur la période.
    const [toutesLesDepenses, tousLesAchats] = await Promise.all([
      database.get("depenses").query(Q.where("user_id", userId)).fetch(),
      database.get("achats").query(Q.where("user_id", userId)).fetch(),
    ]);
    const totalDepenses = (toutesLesDepenses as any[]).filter((d) => d.creeLe >= debut && d.creeLe <= fin).reduce((s, d) => s + d.montant, 0);
    const totalAchats = (tousLesAchats as any[]).filter((a) => a.creeLe >= debut && a.creeLe <= fin).reduce((s, a) => s + a.montant, 0);

    if (ventes.length === 0) {
      setStats({ ...STATS_VIDES, depenses: totalDepenses, achats: totalAchats });
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
      const categorie = produit?.categorieNom ?? t("dashboard_sans_categorie", langue);
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

    // « Ventes » = nombre de transactions (regroupées par transactionId) ;
    // « Produits vendus » = total des unités.
    const transactions = new Set(
      (ventes as any[]).map((v) => {
        try { return JSON.parse(v.donneesSupplementairesJson || "{}").transactionId ?? v.id; }
        catch { return v.id; }
      })
    );
    const produitsVendus = ventes.reduce((s, v) => s + (v.quantite || 0), 0);

    // Liste détaillée des ventes (la plus récente d'abord) pour le rapport PDF.
    const ventesListe = [...ventes]
      .sort((a, b) => b.creeLe.getTime() - a.creeLe.getTime())
      .map((v) => ({
        date: v.creeLe,
        produit: v.produitNom ?? produitsParId.get(v.produitId)?.nom ?? "—",
        client: v.clientNom ?? "—",
        quantite: v.quantite,
        montant: v.quantite * v.prixUnitaire,
        paiement: v.modePaiement ?? "—",
      }));

    setStats({ ca, ventes: transactions.size, produitsVendus, benefice: calculerBenefice(ventes, produitsParId), depenses: totalDepenses, achats: totalAchats, parPaiement, parCategorie, topProduits, topRevenus, topClients, ventesListe });
    setChargement(false);
  }

  const maxCategorie = Math.max(1, ...stats.parCategorie.map((c) => c.montant));

  // Pourcentage de variation, avec signe : « +12 % » / « -5 % ». Renvoie null
  // si la période précédente est à zéro (division impossible — on n'affiche
  // alors rien plutôt qu'un « +∞ % » absurde).
  function variation(actuel: number, precedent: number): string | null {
    if (precedent <= 0) return null;
    const pct = Math.round(((actuel - precedent) / precedent) * 100);
    return `${pct > 0 ? "+" : ""}${pct} %`;
  }

  // Rapport complet de la période affichée : tous les indicateurs, les tops,
  // les répartitions, les mouvements de stock et le détail de chaque vente.
  async function genererRapport() {
    if (generationRapport) return;
    setGenerationRapport(true);
    try {
      const periodeLabel = personnalise
        ? `${formaterDate(debutPerso, langue)} – ${formaterDate(finPerso, langue)}`
        : (t(`periode_${periode}` as any, langue) as string);

      const indicateurs: (string | number)[][] = [
        [t("dashboard_ca", langue), formater(stats.ca)],
        [t("dashboard_benefice", langue), formater(stats.benefice)],
        [t("dashboard_ventes", langue), stats.ventes],
        [t("dashboard_produits_vendus", langue), stats.produitsVendus],
        [t("depenses_titre", langue), formater(stats.depenses)],
        [t("plus_achats", langue), formater(stats.achats)],
        [t("dashboard_ruptures", langue), ruptures],
        [t("dashboard_stock_faible", langue), alertes],
      ];
      // L'évolution n'a de sens que sur une période standard (pas de
      // « période précédente » définie pour une plage personnalisée).
      if (!personnalise) {
        const evol = [variation(stats.ca, precedente.ca), variation(stats.ventes, precedente.ventes), variation(stats.benefice, precedente.benefice)]
          .filter(Boolean)
          .join(" · ");
        if (evol) indicateurs.push([t("rapport_evolution", langue), evol]);
      }

      const sections: SectionRapport[] = [
        { titre: t("rapport_indicateurs", langue), colonnes: [{ libelle: t("rapport_col_indicateur", langue) }, { libelle: t("rapport_col_valeur", langue), aligneDroite: true }], lignes: indicateurs },
        { titre: t("dashboard_par_categorie", langue), colonnes: [{ libelle: t("produit_categorie_label", langue) }, { libelle: t("rapport_col_montant", langue), aligneDroite: true }], lignes: stats.parCategorie.map((c) => [c.nom, formater(c.montant)]) },
        { titre: t("dashboard_top_produits", langue), colonnes: [{ libelle: t("rapport_col_produit", langue) }, { libelle: t("dashboard_ventes", langue), aligneDroite: true }, { libelle: t("rapport_col_montant", langue), aligneDroite: true }], lignes: stats.topProduits.map((p) => [p.nom, p.ventes, formater(p.montant)]) },
        { titre: t("dashboard_top_revenus", langue), colonnes: [{ libelle: t("rapport_col_produit", langue) }, { libelle: t("rapport_col_montant", langue), aligneDroite: true }], lignes: stats.topRevenus.map((p) => [p.nom, formater(p.montant)]) },
        { titre: t("dashboard_top_clients", langue), colonnes: [{ libelle: t("rapport_col_client", langue) }, { libelle: t("rapport_col_montant", langue), aligneDroite: true }], lignes: stats.topClients.map((c) => [c.nom, formater(c.montant)]) },
        { titre: t("dashboard_par_paiement", langue), colonnes: [{ libelle: t("rapport_col_paiement", langue) }, { libelle: t("rapport_col_montant", langue), aligneDroite: true }], lignes: Object.entries(stats.parPaiement).map(([mode, montant]) => [mode, formater(montant)]) },
        { titre: t("dashboard_mouvements", langue), colonnes: [{ libelle: t("rapport_col_produit", langue) }, { libelle: t("rapport_col_quantite", langue), aligneDroite: true }], lignes: mouvements.map((m) => [m.nomProduit, `${m.quantite >= 0 ? "+" : ""}${m.quantite}`]) },
        {
          titre: t("rapport_detail_ventes", langue),
          colonnes: [
            { libelle: t("rapport_col_date", langue) },
            { libelle: t("rapport_col_produit", langue) },
            { libelle: t("rapport_col_client", langue) },
            { libelle: t("rapport_col_quantite", langue), aligneDroite: true },
            { libelle: t("rapport_col_montant", langue), aligneDroite: true },
            { libelle: t("rapport_col_paiement", langue), aligneDroite: true },
          ],
          lignes: stats.ventesListe.map((v) => [formaterDate(v.date, langue), v.produit, v.client, v.quantite, formater(v.montant), v.paiement]),
        },
      ];

      await genererRapportPdf({
        titre: `${t("rapport_titre", langue)} — ${t("dashboard_titre", langue)}`,
        sousTitre: periodeLabel,
        sections,
        langue,
        nomFichier: `Rapport-${periodeLabel.replace(/\s+/g, "-")}.pdf`,
        descriptionActivite: `Rapport dashboard généré (${periodeLabel})`,
      });
    } catch {
      showToast(t("rapport_erreur", langue), "error");
    } finally {
      setGenerationRapport(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <View style={styles.entete}>
      <View style={styles.enteteGauche}>
         <Pressable onPress={() => router.push("/reglages")} hitSlop={10}>
            <Feather name="menu" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={{ fontSize: 16, fontWeight: "500", color: colors.textPrimary }}>{t("dashboard_titre", langue)}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
        {!planPret || !essai.verifie ? (
            // Tant que le statut n'est pas vérifié, on n'affiche ni le badge
            // Pro ni le bouton « Passer Pro » — sinon ce dernier clignotait à
            // tort pour un abonné au démarrage.
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (estPremium || essai.actif) ? (
            <>
            <Badge texte={t("version_pro", langue)} type="pro" />
            {/* Le bouton génère le rapport de la période affichée, au lieu de
                renvoyer vers l'écran d'export : le rapport doit contenir tout
                ce que le dashboard montre. */}
            <BoutonRapport onPress={genererRapport} enCours={generationRapport} />
            </>
          ) : (
            <Pressable onPress={() => router.push("/premium")} style={{ backgroundColor: colors.proBg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
            <Text style={{ color: colors.pro, fontSize: 11 }}>{t("upgrade_pro", langue)}</Text>
          </Pressable>
          )}
        </View>
      </View>
      


      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View>
        <SelecteurPeriode
        
          periode={periode}
          onChange={setPeriode}
          plan={planEffectif}
          personnalise={personnalise}
          onVerrouille={() => afficherPaywall(langue, () => router.push("/premium"))}
          onPersonnalise={() => {
            if (essai.statut === "FREE") {
              afficherPaywall(langue, () => router.push("/premium"));
              return;
            }
            setPersonnalise(!personnalise);
          }}
        />


        {personnalise && (
          <View style={styles.blocPersonnalise}>
            <Pressable onPress={() => setAfficherDatePicker("debut")} style={[styles.champDate, { borderColor: colors.border }]}>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t("dashboard_du", langue)}</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{debutPerso.toLocaleDateString(langue === "fr" ? "fr-FR" : "en-US")}</Text>
            </Pressable>
            <Pressable onPress={() => setAfficherDatePicker("fin")} style={[styles.champDate, { borderColor: colors.border }]}>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t("dashboard_au", langue)}</Text>
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
            <Text style={[styles.titreSection, { color: colors.textMuted }]}>{t("dashboard_section_ventes", langue)}</Text>
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
              <View style={{ flexDirection: "row" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t("dashboard_ventes", langue)}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "500" }}>{stats.ventes}</Text>
                    <Fleche actuel={stats.ventes} precedent={precedente.ventes} />
                  </View>
                </View>
                <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 14 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t("produits_vendus", langue)}</Text>
                  <Text style={{ color: colors.accent, fontSize: 20, fontWeight: "500", marginTop: 4 }}>{stats.produitsVendus}</Text>
                </View>
              </View>
            </Carte>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Pressable onPress={() => router.push({ pathname: "/stock", params: { statut: "rupture" } })} style={{ flex: 1 }}>
                <Carte style={{ backgroundColor: ruptures > 0 ? colors.dangerBg : colors.surface }}>
                  <View style={{ alignItems: "center", gap: 4 }}>
                    <Text style={{ color: ruptures > 0 ? colors.danger : colors.textSecondary, fontSize: 11 }}>
                      {t("stock_statut_rupture", langue)}
                    </Text>
                    <View style={{ flexDirection:"row", alignItems:"center", gap:10}}>
                    <Text style={{ color: ruptures > 0 ? colors.danger : colors.textSecondary, fontSize: 22, fontWeight: "700" }}>{ruptures}</Text>
                    <Feather name="alert-triangle" size={16} color={ruptures > 0 ? colors.danger : colors.textMuted} />

                    </View>
                  </View>
                </Carte>
              </Pressable>
              <Pressable onPress={() => router.push({ pathname: "/stock", params: { statut: "faible" } })} style={{ flex: 1 }}>
                <Carte style={{ backgroundColor: alertes > 0 ? colors.warningBg : colors.surface }}>
                  <View style={{  gap: 4, }}>
                        <Text style={{ color: alertes > 0 ? colors.warning : colors.textSecondary, fontSize: 11,  }}>
                          {t("stock_statut_faible", langue)}
                        </Text>
                      <View style={{ flexDirection:"row", alignItems:"center", gap:10}}>
                        <Text style={{ color: alertes > 0 ? colors.warning : colors.textSecondary, fontSize: 22, fontWeight: "700" }}>{alertes}</Text>
                        <Feather name="trending-down" size={16} color={alertes > 0 ? colors.warning : colors.textMuted} />
                      </View>
                  </View>
                </Carte>
              </Pressable>
            </View>

            {/* Section sorties : dépenses et achats de la période */}
            <Text style={[styles.titreSection, { color: colors.textMuted }]}>{t("dashboard_section_sorties", langue)}</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable onPress={() => router.push("/depenses")} style={{ flex: 1 }}>
                <Carte>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Feather name="credit-card" size={13} color={colors.danger} />
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{t("depenses_titre", langue)}</Text>
                  </View>
                  <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "500", marginTop: 4 }}>{formater(stats.depenses)}</Text>
                </Carte>
              </Pressable>
              <Pressable onPress={() => router.push("/achats")} style={{ flex: 1 }}>
                <Carte>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Feather name="truck" size={13} color={colors.puceAmbre} />
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{t("plus_achats", langue)}</Text>
                  </View>
                  <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "500", marginTop: 4 }}>{formater(stats.achats)}</Text>
                </Carte>
              </Pressable>
            </View>

            {/* Répartition par catégorie */}
            <Text style={[styles.titreSection, { color: colors.textMuted }]}>{t("dashboard_section_analyse", langue)}</Text>
            {stats.parCategorie.length > 0 && (
              <Carte style={{ marginTop: 12 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500", marginBottom: 12 }}>{t("dashboard_par_categorie", langue)}</Text>
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
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500", marginBottom: 10 }}>{t("dashboard_top_produits", langue)}</Text>
              {stats.topProduits.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t("dashboard_vide", langue)}</Text>
              ) : (
                stats.topProduits.map((p, i) => (
                  <View key={p.nom} style={[styles.ligneTop, i < stats.topProduits.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                    <Medaille rang={i} />
                    <Text style={{ fontSize: 12, color: colors.textPrimary, flex: 1 }}>{p.nom}</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginRight: 10 }}>{p.ventes} ventes</Text>
                    <Text style={{ fontSize: 12, fontWeight: "500", color: colors.textPrimary }}>{formater(p.montant)}</Text>
                  </View>
                ))
              )}
            </Carte>

            {/* Produits générant le plus de revenus */}
            <Carte style={{ marginTop: 12 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500", marginBottom: 10 }}>{t("dashboard_top_revenus", langue)}</Text>
              {stats.topRevenus.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t("dashboard_vide", langue)}</Text>
              ) : (
                stats.topRevenus.map((p, i) => (
                  <View key={p.nom} style={[styles.ligneTop, i < stats.topRevenus.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                    <Medaille rang={i} />
                    <Text style={{ fontSize: 12, color: colors.textPrimary, flex: 1 }}>{p.nom}</Text>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.accent }}>{formater(p.montant)}</Text>
                  </View>
                ))
              )}
            </Carte>

            {/* Top clients */}
            <Carte style={{ marginTop: 12 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500", marginBottom: 10 }}>{t("dashboard_top_clients", langue)}</Text>
              {stats.topClients.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t("dashboard_vide", langue)}</Text>
              ) : (
                stats.topClients.map((c, i) => (
                  <View key={c.nom} style={[styles.ligneTop, i < stats.topClients.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                    <View style={[styles.avatar, { backgroundColor: i === 0 ? colors.accent : colors.accentBg }]}>
                      <Text style={{ color: i === 0 ? "#fff" : colors.accent, fontSize: 11, fontWeight: "600" }}>{c.nom.slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textPrimary, flex: 1 }}>{c.nom}</Text>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.accent }}>{formater(c.montant)}</Text>
                  </View>
                ))
              )}
            </Carte>

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
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500", marginBottom: 10 }}>{t("dashboard_mouvements", langue)}</Text>
              {mouvements.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t("mouvements_aucun", langue)}</Text>
              ) : (
                mouvements.map((m, i) => (
                  <View key={m.id} style={[styles.ligneTop, i < mouvements.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                    <Text style={{ fontSize: 12, color: colors.textPrimary, flex: 1 }}>{m.nomProduit}</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginRight: 10 }}>{t(`mouvement_type_${m.type}` as any, langue) as string} {m.quantite > 0 ? "+" : ""}{m.quantite}</Text>
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
  titreSection: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 18, marginBottom: 8, marginLeft: 2 },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  boutonPersonnalise: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 5 },
  blocPersonnalise: { flexDirection: "row", gap: 10, marginTop: 2, marginBottom: 8 },
  champDate: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  ligneDeuxCartes: { flexDirection: "row", gap: 10 },
  etatVide: { alignItems: "center", paddingTop: 40 },
  ligneTop: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", marginRight: 10 },
  lignePaiement: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  enteteGauche: { flexDirection: "row", alignItems: "center", gap: 10 },

});