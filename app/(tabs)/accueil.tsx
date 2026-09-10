import { useState, useCallback } from "react";
import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { useLangue, t } from "@/lib/i18n";
import { usePlanActuel } from "@/lib/plan/usePlanActuel";
import { supabase } from "@/lib/supabase/client";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { TourGuide } from "@/components/TourGuide";
import { useTourGuide } from "@/lib/onboarding/useTourGuide";
import { BoutonFlottant } from "@/components/BoutonFlottant";
import { Skeleton } from "@/components/UI";
import { detecterAlertes } from "@/lib/notifications/notifications";
import { estEssaiActifLocal } from "@/lib/trial/deviceTrial";
import { peutEcrire } from "@/lib/trial/gate";


type VenteRecente = { nom: string; montant: number; source: "vocal" | "scan" | "manuel" };

export default function Accueil() {
  const { colors } = useTheme();
  const { formater } = useCurrency();
  const { langue } = useLangue();
  const { showToast } = useToast();
  const { planId, pret: planPret } = usePlanActuel();
  const [nomBoutique, setNomBoutique] = useState("");
  const [ca, setCa] = useState(0);
  const [nbVentes, setNbVentes] = useState(0);
  const [onTeDoit, setOnTeDoit] = useState(0);
  const [tuDois, setTuDois] = useState(0);
  const [ventesRecentes, setVentesRecentes] = useState<VenteRecente[]>([]);
  const [chargementVentes, setChargementVentes] = useState(true);
  const [nbNotifsNonLues, setNbNotifsNonLues] = useState(0);
  const [essaiExpire, setEssaiExpire] = useState(false);
  const { afficherTour, terminerTour } = useTourGuide();

  useFocusEffect(
    useCallback(() => {
      chargerDonnees();
    }, [])
  );

  async function chargerDonnees() {
    const nom = await AsyncStorage.getItem("boutika_nom_boutique");
    if (nom) setNomBoutique(nom);

    setChargementVentes(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const debutJour = new Date();
      debutJour.setHours(0, 0, 0, 0);

      const toutesLesVentes = await database.get("ventes").query(Q.where("user_id", user.id), Q.sortBy("cree_le", Q.desc)).fetch();
      const ventesAujourdhui = (toutesLesVentes as any[]).filter((v) => v.creeLe >= debutJour);

      setCa(ventesAujourdhui.reduce((s, v) => s + v.quantite * v.prixUnitaire, 0));
      setNbVentes(ventesAujourdhui.length);
      setVentesRecentes((toutesLesVentes as any[]).slice(0, 5).map((v) => ({
        nom: v.produitNom ?? v.clientNom ?? "—",
        montant: v.quantite * v.prixUnitaire,
        source: v.source,
      })));

      const creances = await database.get("creances_dettes").query(Q.where("user_id", user.id), Q.where("statut", Q.notEq("payee"))).fetch();
      setOnTeDoit((creances as any[]).filter((c) => c.type === "creance").reduce((s, c) => s + c.montantRestant, 0));
      setTuDois((creances as any[]).filter((c) => c.type === "dette").reduce((s, c) => s + c.montantRestant, 0));
    }
    setChargementVentes(false);

    chargerNotifsNonLues();
    verifierEssai();
  }

  async function verifierEssai() {
    if (planId === "premium") { setEssaiExpire(false); return; }
    const actif = await estEssaiActifLocal();
    setEssaiExpire(!actif);
  }

  async function chargerNotifsNonLues() {
    let total = 0;
    try {
      const { nbRuptures, nbRetards } = await detecterAlertes();
      total += nbRuptures + nbRetards;
    } catch {}
    try {
      const { data } = await supabase.from("notifications").select("id").eq("lu", false);
      total += (data ?? []).length;
    } catch {}
    setNbNotifsNonLues(total);
  }

  function fonctionnaliteBientotDisponible() {
    showToast(t("bientot_disponible_texte", langue), "info");
  }

  const estPremium = planId === "premium";
  const benefice = Math.round(ca * 0.3);

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
        </View>
        <View style={styles.enteteDroite}>
          {!planPret ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            !estPremium && (
              <Pressable onPress={() => router.push("/premium")} style={[styles.boutonPassePro, { backgroundColor: colors.proFill }]}>
                <Text style={{ color: colors.onPro, fontSize: 11 }}>{t("passer_pro", langue)}</Text>
              </Pressable>
            )
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
      {essaiExpire && (
        <Pressable onPress={() => router.push("/premium")} style={[styles.banniereEssai, { backgroundColor: colors.proBg, borderColor: colors.borderPro }]}>
          <Feather name="lock" size={16} color={colors.pro} />
          <Text style={{ color: colors.pro, fontSize: 13, flex: 1 }}>{t("essai_expire", langue)}</Text>
          <Feather name="chevron-right" size={16} color={colors.pro} />
        </Pressable>
      )}
      {/* Chiffre d'affaires */}
      <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }}>{t("ca_aujourdhui", langue)}</Text>
        {chargementVentes ? (
          <Skeleton width="60%" height={26} style={{ marginVertical: 8 }} />
        ) : (
          <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: "700", marginVertical: 4 }}>{formater(ca)}</Text>
        )}
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{!chargementVentes && ca === 0 ? t("aucune_vente_jour", langue) : ""}</Text>
      </View>

      <View style={styles.ligneDeuxCartes}>
        <View style={[styles.cartePetite, { backgroundColor: colors.warningBg, borderColor: colors.border }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "500" }}>{t("ventes_du_jour", langue)}</Text>
          {chargementVentes ? <Skeleton width="40%" height={18} style={{ marginTop: 4 }} /> : <Text style={{ color: colors.warning, fontSize: 18, fontWeight: "700" }}>{nbVentes}</Text>}
        </View>
        <View style={[styles.cartePetite, { backgroundColor: colors.successBg, borderColor: colors.border }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "500" }}>{t("benefice_estime", langue)}</Text>
          {chargementVentes ? <Skeleton width="50%" height={18} style={{ marginTop: 4 }} /> : <Text style={{ color: colors.success, fontSize: 18, fontWeight: "700" }}>{formater(benefice)}</Text>}
        </View>
      </View>

      {/* Créances et dettes */}
      <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
        <Pressable onPress={() => router.push("/creances")} style={styles.enTeteCreances}>
          <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{t("creances_dettes", langue)}</Text>
          <Feather name="chevron-right" size={16} color={colors.textMuted} />
        </Pressable>
        <Pressable style={styles.ligneCreance} onPress={() => router.push("/creances")}>
          <View style={styles.ligneGauche}>
            <Feather name="arrow-down-left" size={15} color={colors.success} />
            <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{t("on_te_doit", langue)}</Text>
          </View>
          <Text style={{ color: colors.success, fontSize: 14, fontWeight: "700" }}>{formater(onTeDoit)}</Text>
        </Pressable>
        <Pressable style={styles.ligneCreance} onPress={() => router.push("/creances")}>
          <View style={styles.ligneGauche}>
            <Feather name="arrow-up-right" size={15} color={colors.danger} />
            <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{t("tu_dois", langue)}</Text>
          </View>
          <Text style={{ color: colors.danger, fontSize: 14, fontWeight: "700" }}>{formater(tuDois)}</Text>
        </Pressable>
      </View>

      {/* Bloc Vocal/Scan — désactivés pour le MVP */}
      <View style={[styles.barreAction, { borderColor: colors.borderPro, opacity: 0.6, marginTop: 14 }]}>
        <Text style={{ flex: 1, color: colors.pro, fontSize: 13 }}>{t("enregistrer_vente", langue)}</Text>
        <Pressable onPress={fonctionnaliteBientotDisponible} style={[styles.boutonRondPro, { backgroundColor: colors.proFill }]}>
          <Feather name="camera" size={18} color={colors.onPro} />
        </Pressable>
        <Pressable onPress={fonctionnaliteBientotDisponible} style={[styles.boutonRondPro, { backgroundColor: colors.proFill }]}>
          <Feather name="mic" size={18} color={colors.onPro} />
        </Pressable>
      </View>
      <View style={styles.ligneInfo}>
        <Feather name="clock" size={12} color={colors.textMuted} />
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{t("bientot_disponible_texte", langue)}</Text>
      </View>



      {/* Ventes récentes */}
      <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 20, marginTop:30 }]}>
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
          ventesRecentes.map((v, i) => (
            <View key={i} style={styles.ligneCreance}>
              <View style={styles.ligneGauche}>
                <Feather name={v.source === "vocal" ? "mic" : v.source === "scan" ? "camera" : "edit-3"} size={13} color={colors.textMuted} />
                <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{v.nom}</Text>
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{formater(v.montant)}</Text>
            </View>
          ))
        )}
      </View>

      </ScrollView>

      <TourGuide visible={afficherTour} onTerminer={terminerTour} />
      <BoutonFlottant onPress={async () => {
        if (!(await peutEcrire())) { showToast(t("essai_expire", langue), "error"); return; }
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
  enteteDroite: { flexDirection: "row", alignItems: "center", gap: 10 },
  carte: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 12 },
  ligneDeuxCartes: { flexDirection: "row", gap: 10 },
  cartePetite: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 12 },
  ligneCreance: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  ligneGauche: { flexDirection: "row", alignItems: "center", gap: 8 },
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