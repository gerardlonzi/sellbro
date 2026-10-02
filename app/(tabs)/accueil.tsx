import { useState, useCallback, useRef, useEffect } from "react";
import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Share } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { useLangue, t } from "@/lib/i18n";
import { usePlanActuel } from "@/lib/plan/usePlanActuel";
import { supabase } from "@/lib/supabase/client";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { obtenirUserId } from "@/lib/auth/userCache";
import { BoutonFlottant } from "@/components/BoutonFlottant";
import { AvatarNom } from "@/components/AvatarNom";
import { Skeleton } from "@/components/UI";
import { PuceIcone } from "@/components/PuceIcone";
import { ObjectifJour } from "@/components/ObjectifJour";
import { WelcomeTrial } from "@/components/WelcomeTrial";
import { IndicateurSync } from "@/components/SyncBanner";
import { peutEcrire } from "@/lib/trial/gate";
import { afficherPaywall } from "@/lib/trial/paywall";
import { versionDonnees, sAbonnerModifications } from "@/lib/dataVersion";
import { useEssai } from "@/lib/trial/useEssai";
import { nombreNotificationsNonLues } from "@/lib/notifications/notifications";
import { calculerBenefice } from "@/lib/ventes/benefice";




type VenteRecente = { nom: string; montant: number; modePaiement: "cash" | "momo" | "credit" | null };

// Puce colorée du moyen de paiement — une couleur par mode.
const COULEURS_PAIEMENT: Record<string, { fond: string; texte: string }> = {
  cash: { fond: "#DFF3EB", texte: "#0E6A51" },
  momo: { fond: "#FFF3CC", texte: "#8A6D00" },
  credit: { fond: "#E3EDFB", texte: "#1D4ED8" },
};

export default function Accueil() {
  const { colors } = useTheme();
  const { formater, formaterCompact } = useCurrency();
  const { langue } = useLangue();
  const { planId, pret: planPret } = usePlanActuel();
  const [nomBoutique, setNomBoutique] = useState("");
  const [ca, setCa] = useState(0);
  const [benefice, setBenefice] = useState(0);
  const [nbVentes, setNbVentes] = useState(0);
  const [nbProduitsVendus, setNbProduitsVendus] = useState(0);
  const [onTeDoit, setOnTeDoit] = useState(0);
  const [tuDois, setTuDois] = useState(0);
  const [ventesRecentes, setVentesRecentes] = useState<VenteRecente[]>([]);
  const [topProduitJour, setTopProduitJour] = useState<string | null>(null);
  const [chargementVentes, setChargementVentes] = useState(true);
  const [nbNotifsNonLues, setNbNotifsNonLues] = useState(0);

  const derniereVersion = useRef<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (derniereVersion.current === null || versionDonnees() !== derniereVersion.current) {
        derniereVersion.current = versionDonnees();
        chargerDonnees();
      }
    }, [])
  );

  // Recharge aussi l'accueil dès qu'une sync/écriture modifie les données
  // (sinon il fallait naviguer ailleurs puis revenir pour voir les données).
  useEffect(() => {
    return sAbonnerModifications(() => {
      derniereVersion.current = versionDonnees();
      chargerDonnees();
    });
  }, []);

  // Le badge de notifications se rafraîchit à chaque focus (léger),
  // pour diminuer dès qu'une notification a été marquée « lue ».
  useFocusEffect(
    useCallback(() => {
      chargerNotifsNonLues();
    }, [])
  );

  async function chargerDonnees() {
    let nom = await AsyncStorage.getItem("boutika_nom_boutique");

    setChargementVentes(true);
    // `obtenirUserId` lit le token local (hors ligne), pas getUser() qui fait
    // un appel réseau et bloquait l'accueil sans connexion.
    const userId = await obtenirUserId();
    // Si le nom n'est pas en cache local, on le récupère depuis le profil
    // Supabase (ex: renseigné à l'inscription via config-boutique).
    if (!nom && userId) {
      try {
        const { data } = await supabase.from("profiles").select("nom_boutique").eq("id", userId).single();
        if (data?.nom_boutique) {
          nom = data.nom_boutique;
          await AsyncStorage.setItem("boutika_nom_boutique", data.nom_boutique);
        }
      } catch {}
    }
    if (nom) setNomBoutique(nom);

    if (userId) {
      const debutJour = new Date();
      debutJour.setHours(0, 0, 0, 0);

      const toutesLesVentes = await database.get("ventes").query(Q.where("user_id", userId), Q.sortBy("cree_le", Q.desc)).fetch();
      const ventesAujourdhui = (toutesLesVentes as any[]).filter((v) => v.creeLe >= debutJour);

      setCa(ventesAujourdhui.reduce((s, v) => s + v.quantite * v.prixUnitaire, 0));
      // Bénéfice réel du jour : Σ quantité × (prix vente − prix achat).
      const tousLesProduits = await database.get("produits").query(Q.where("user_id", userId)).fetch();
      const produitsParId = new Map((tousLesProduits as any[]).map((p) => [p.id, p]));
      setBenefice(calculerBenefice(ventesAujourdhui, produitsParId));
      // « Ventes du jour » = nombre de TRANSACTIONS (regroupées par transactionId) ;
      // « Produits vendus » = total des unités.
      const transactions = new Set(
        (ventesAujourdhui as any[]).map((v) => {
          try { return JSON.parse(v.donneesSupplementairesJson || "{}").transactionId ?? v.id; }
          catch { return v.id; }
        })
      );
      setNbVentes(transactions.size);
      setNbProduitsVendus((ventesAujourdhui as any[]).reduce((s, v) => s + (v.quantite || 0), 0));
      // Produit star du jour (le plus vendu en unités) — utilisé par le bilan partageable.
      const parProduit: Record<string, number> = {};
      for (const v of ventesAujourdhui as any[]) {
        const n = v.produitNom ?? "—";
        parProduit[n] = (parProduit[n] ?? 0) + (v.quantite || 0);
      }
      const top = Object.entries(parProduit).sort((a, b) => b[1] - a[1])[0];
      setTopProduitJour(top && top[0] !== "—" ? top[0] : null);
      setVentesRecentes((toutesLesVentes as any[]).slice(0, 5).map((v) => ({
        nom: v.produitNom ?? v.clientNom ?? "—",
        montant: v.quantite * v.prixUnitaire,
        modePaiement: v.modePaiement ?? null,
      })));

      const creances = await database.get("creances_dettes").query(Q.where("user_id", userId), Q.where("statut", Q.notEq("payee"))).fetch();
      setOnTeDoit((creances as any[]).filter((c) => c.type === "creance").reduce((s, c) => s + c.montantRestant, 0));
      setTuDois((creances as any[]).filter((c) => c.type === "dette").reduce((s, c) => s + c.montantRestant, 0));
    }
    setChargementVentes(false);

    chargerNotifsNonLues();
  }

  async function chargerNotifsNonLues() {
    // Compte les non-lues via le helper qui fonctionne aussi hors ligne
    // (cache local + alertes détectées dans la base locale).
    const total = await nombreNotificationsNonLues();
    setNbNotifsNonLues(total);
  }

  // Bilan du jour en texte, partagé via la feuille système (WhatsApp, SMS…).
  // Le gérant l'envoie à son groupe ou le met en statut — sans rapport PDF.
  async function partagerBilan() {
    const boutique = nomBoutique || t("nom_boutique_par_defaut", langue);
    const lignes = [
      `*${boutique}* — ${new Date().toLocaleDateString(langue === "fr" ? "fr-FR" : "en-US")}`,
      `${t("bilan_ligne_ca", langue)} : ${formater(ca)}`,
      `${t("bilan_ligne_ventes", langue)} : ${nbVentes}`,
      `${t("bilan_ligne_produits", langue)} : ${nbProduitsVendus}`,
      ...(topProduitJour ? [`${t("bilan_ligne_top", langue)} : ${topProduitJour}`] : []),
    ];
    await Share.share({ message: lignes.join("\n") }).catch(() => {});
  }

  const estPremium = planId === "premium";
  const essai = useEssai();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      {/* En-tête fixe */}
      <View style={[styles.entete, { backgroundColor: colors.background }]}>
        <View style={styles.enteteGauche}>
          <Pressable onPress={() => router.push("/reglages")} hitSlop={10}>
            <Feather name="menu" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "600" }}>
            {nomBoutique || t("nom_boutique_par_defaut", langue)}
          </Text>
          {/* Puce « PRO » compacte à côté du nom (essai ou abonnement actif).
              Remplace le badge « Version Pro » qui prenait trop de place dans
              l'en-tête. */}
          {(planPret && essai.verifie) && (estPremium || essai.actif) && (
            <Pressable onPress={() => router.push("/premium")} style={[styles.pucePro, { backgroundColor: colors.proFill }]}>
              <Text style={{ color: colors.onPro, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 }}>PRO</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.enteteDroite}>
          {/* Le bouton « Passer Pro » n'apparaît qu'aux comptes sans accès —
              et seulement une fois le statut vérifié (sinon il clignotait
              pour un abonné au démarrage). */}
          {planPret && essai.verifie && !estPremium && !essai.actif && (
            <Pressable onPress={() => router.push("/premium")} style={{ backgroundColor: colors.proBg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
              <Text style={{ color: colors.pro, fontSize: 11 }}>{t("upgrade_pro", langue)}</Text>
            </Pressable>
          )}
          {/* État de sync : petit cloud à gauche de la cloche (spinner pendant
              la sync, coche verte quelques secondes, cloud gris sinon). */}
          <IndicateurSync />
          {/* Partage du bilan du jour (WhatsApp, SMS…) — visible seulement
              quand il y a eu au moins une vente. */}
          {!chargementVentes && nbVentes > 0 && (
            <Pressable onPress={partagerBilan} hitSlop={8} accessibilityLabel={t("bilan_partager", langue)}>
              <Feather name="share-2" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
          <Pressable onPress={() => router.push("/notifications")} style={{ position: "relative" }}>
            <Feather name="bell" size={20} color={colors.textSecondary} />
            {nbNotifsNonLues > 0 && (
              <View style={[styles.badgeNotif, { backgroundColor: colors.danger }]}>
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
                  {nbNotifsNonLues > 9 ? "9+" : nbNotifsNonLues}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.contenu}>
      {/* `verifie` évite que la bannière « essai expiré » clignote pour un
          abonné Pro le temps que son plan soit lu. */}
      {essai.verifie && !estPremium && !essai.actif && (
        <Pressable onPress={() => router.push("/premium")} style={[styles.banniereEssai, { backgroundColor: colors.proBg, borderColor: colors.borderPro }]}>
          <Feather name="lock" size={16} color={colors.pro} />
          <Text style={{ color: colors.pro, fontSize: 13, flex: 1 }}>{t("essai_expire", langue)}</Text>
          <Feather name="chevron-right" size={16} color={colors.pro} />
        </Pressable>
      )}
      {/* Quatre métriques en grille 2×2 : CA + Bénéfice sur la première ligne,
          Produits vendus + Ventes du jour sur la seconde. Chaque pastille porte
          sa couleur, le chiffre reste neutre. */}
      <View style={styles.ligneDeuxCartes}>
        <View style={[styles.cartePetite, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <PuceIcone icone="dollar-sign" ton="violet" taille={32} />
          {chargementVentes ? <Skeleton width="60%" height={18} style={{ marginTop: 4 }} /> : <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "700", marginTop: 10 }}>{formaterCompact(ca)}</Text>}
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "500", marginTop: 8 }}>{t("ca_aujourdhui", langue)}</Text>
        </View>
        <View style={[styles.cartePetite, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <PuceIcone icone="trending-up" ton="vert" taille={32} />
          {chargementVentes ? <Skeleton width="50%" height={18} style={{ marginTop: 4 }} /> : <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "700", marginTop: 10 }}>{formaterCompact(benefice)}</Text>}
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "500", marginTop: 8 }}>{t("benefice_estime", langue)}</Text>
        </View>
      </View>

      <View style={[styles.ligneDeuxCartes, { marginTop: 10 }]}>
        <View style={[styles.cartePetite, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <PuceIcone icone="package" ton="ambre" taille={32} />
          {chargementVentes ? <Skeleton width="40%" height={18} style={{ marginTop: 4 }} /> : <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "700", marginTop: 10 }}>{nbProduitsVendus}</Text>}
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "500", marginTop: 8 }}>{t("produits_vendus", langue)}</Text>
        </View>
        <View style={[styles.cartePetite, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <PuceIcone icone="shopping-bag" ton="bleu" taille={32} />
          {chargementVentes ? <Skeleton width="40%" height={18} style={{ marginTop: 4 }} /> : <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "700", marginTop: 10 }}>{nbVentes}</Text>}
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "500", marginTop: 8 }}>{t("ventes_du_jour", langue)}</Text>
        </View>
      </View>


      {/* Créances et dettes */}
      <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
        <Pressable onPress={() => router.push("/creances")} style={styles.enTeteCreances}>
          <View style={styles.enTeteMetrique}>
            <PuceIcone icone="repeat" ton="bleu" taille={30} />
            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{t("creances_dettes", langue)}</Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.textMuted} />
        </Pressable>
        <Pressable style={styles.ligneCreance} onPress={() => router.push("/creances")}>
          <View style={styles.ligneGauche}>
            <PuceIcone icone="arrow-down-left" ton="vert" taille={28} />
            <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{t("on_te_doit", langue)}</Text>
          </View>
          {chargementVentes ? <Skeleton width="30%" height={16} /> : <Text style={{ color: colors.success, fontSize: 14, fontWeight: "700" }}>{formaterCompact(onTeDoit)}</Text>}
        </Pressable>
        <Pressable style={styles.ligneCreance} onPress={() => router.push("/creances")}>
          <View style={styles.ligneGauche}>
            <PuceIcone icone="arrow-up-right" ton="rose" taille={28} />
            <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{t("tu_dois", langue)}</Text>
          </View>
          {chargementVentes ? <Skeleton width="30%" height={16} /> : <Text style={{ color: colors.danger, fontSize: 14, fontWeight: "700" }}>{formaterCompact(tuDois)}</Text>}
        </Pressable>
      </View>

      {/* Objectif du jour : progression du CA, modifiable d'un appui. */}
      <ObjectifJour ca={ca} />

      {/* Ventes récentes */}
      <View style={{  marginBottom: 30, marginTop:15, gap:8 , borderRadius: 12, paddingVertical: 16}}>
        <View style={styles.enTeteVentes}>
          <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{t("ventes_recentes", langue)}</Text>
          <Pressable onPress={() => router.push("/(tabs)/ventes")}>
            <Text style={{ color: colors.accent, fontSize: 11 }}>{t("voir_tout", langue)}</Text>
          </Pressable>
        </View>
        {chargementVentes ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 10 }} />
        ) : ventesRecentes.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t("aucune_vente_recente", langue)}</Text>
        ) : (
          ventesRecentes.map((v, i) => {
            const couleursPuce = COULEURS_PAIEMENT[v.modePaiement ?? ""] ?? { fond: colors.surface, texte: colors.textMuted };
            return (
              <View key={i} style={[styles.ligneCreance, {backgroundColor:colors.surface, padding:10, borderRadius:10}]}>
                {/* Colonne 1 : avatar initiales + nom du produit */}
                <View style={[styles.ligneGauche, { flex: 1 }]}>
                  <AvatarNom nom={v.nom} taille={28} />
                  <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 13, flexShrink: 1 }}>{v.nom}</Text>
                </View>
                {/* Colonne 2 : prix total (prix unitaire × quantité) */}
                <Text style={{ color: colors.textSecondary, fontSize: 12, width: 90, textAlign: "right" }}>{formater(v.montant)}</Text>
                {/* Colonne 3 : moyen de paiement en puce colorée */}
                {v.modePaiement ? (
                  <View style={{ backgroundColor: couleursPuce.fond, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8, width: 62, alignItems: "center" }}>
                    <Text style={{ color: couleursPuce.texte, fontSize: 10, fontWeight: "600" }} numberOfLines={1}>
                      {t(`vente_paiement_${v.modePaiement}` as any, langue)}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </View>

      </ScrollView>

      <WelcomeTrial />
      <BoutonFlottant onPress={async () => {
        if (!(await peutEcrire())) { afficherPaywall(langue, () => router.push("/premium")); return; }
        router.push("/produit/nouveau");
      }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 5, paddingTop: 50 },
  contenu: {  paddingBottom: 90 },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 25 },
  enteteGauche: { flexDirection: "row", alignItems: "center", gap: 10 },
  pucePro: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  enteteDroite: { flexDirection: "row", alignItems: "center", gap: 10 },
  // La bordure est portée par le style partagé plutôt que répétée en ligne sur
  // chaque carte : elle restait sinon absente de certaines, et incohérente.
  carte: { borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1 },
  ligneDeuxCartes: { flexDirection: "row", gap: 10 },
  cartePetite: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 12 },
  ligneCreance: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  ligneGauche: { flexDirection: "row", alignItems: "center", gap: 10 },
  enTeteMetrique: { flexDirection: "row", alignItems: "center", gap: 10 },
  barreAction: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 24, padding: 8, paddingLeft: 16 },
  boutonRondPro: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  boutonPassePro: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  badgeNotif: { position: "absolute", top: -6, right: -8, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  banniereEssai: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  ligneInfo: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  boutonCirculaireAjout: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
  enTeteVentes: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  enTeteCreances: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
});