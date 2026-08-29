import { useEffect, useState } from "react";
import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useConnexion } from "@/lib/useConnexion";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { useLangue, t } from "@/lib/i18n";
import { usePlanActuel } from "@/lib/plan/usePlanActuel";
import { supabase } from "@/lib/supabase/client";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { TourGuide } from "@/components/TourGuide";
import { AccountPopup } from "@/components/AccountPopup";
import { useTourGuide } from "@/lib/onboarding/useTourGuide";
import { BoutonFlottant } from "@/components/BoutonFlottant";


type VenteRecente = { nom: string; montant: number; source: "vocal" | "scan" | "manuel" };

export default function Accueil() {
  const { colors } = useTheme();
  const enLigne = useConnexion();
  const { formater } = useCurrency();
  const { langue } = useLangue();
  const { planId, plan, pret: planPret } = usePlanActuel();
  const [nomBoutique, setNomBoutique] = useState("");
  const [ca, setCa] = useState(0);
  const [nbVentes, setNbVentes] = useState(0);
  const [onTeDoit, setOnTeDoit] = useState(0);
  const [tuDois, setTuDois] = useState(0);
  const [ventesRecentes, setVentesRecentes] = useState<VenteRecente[]>([]);
  const [chargementVentes, setChargementVentes] = useState(true);
  const { afficherTour, terminerTour } = useTourGuide();
  const [afficherPopupCompte, setAfficherPopupCompte] = useState(false);

  useEffect(() => {
    chargerDonnees();
  }, []);

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

    verifierAffichagePopupCompte();
  }

  async function verifierAffichagePopupCompte() {
    const dejaVu = await AsyncStorage.getItem("popup_compte_vu");
    if (dejaVu) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return;
    if (nbVentes >= 2) setAfficherPopupCompte(true);
  }

  function fonctionnaliteBientotDisponible() {
    Alert.alert(t("bientot_disponible_titre", langue), t("bientot_disponible_texte", langue));
  }

  const desactive = !enLigne;
  const estPremium = planId === "premium";
  const benefice = Math.round(ca * 0.3);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      {/* En-tête : hamburger + nom boutique, puis cloche */}
      <View style={styles.entete}>
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
          <Pressable onPress={() => router.push("/notifications")}>
            <Feather name="bell" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Chiffre d'affaires */}
      <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }}>{t("ca_aujourdhui", langue)}</Text>
        <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: "700", marginVertical: 4 }}>{formater(ca)}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{ca === 0 ? t("aucune_vente_jour", langue) : ""}</Text>
      </View>

      <View style={styles.ligneDeuxCartes}>
        <View style={[styles.cartePetite, { backgroundColor: colors.warningBg, borderColor: colors.border }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "500" }}>{t("ventes_du_jour", langue)}</Text>
          <Text style={{ color: colors.warning, fontSize: 18, fontWeight: "700" }}>{nbVentes}</Text>
        </View>
        <View style={[styles.cartePetite, { backgroundColor: colors.successBg, borderColor: colors.border }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "500" }}>{t("benefice_estime", langue)}</Text>
          <Text style={{ color: colors.success, fontSize: 18, fontWeight: "700" }}>{formater(benefice)}</Text>
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

      <TourGuide visible={afficherTour} onTerminer={terminerTour} />
      <AccountPopup
        visible={afficherPopupCompte}
        onFermer={async () => {
          setAfficherPopupCompte(false);
          await AsyncStorage.setItem("popup_compte_vu", "true");
        }}
      />
      <BoutonFlottant onPress={() => router.push("/produit/nouveau")} />

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, paddingTop: 50, height:'100%' },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
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
  ligneInfo: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  boutonCirculaireAjout: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
  enTeteVentes: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  enTeteCreances: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
});