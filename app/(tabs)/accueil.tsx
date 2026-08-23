import { useEffect, useState } from "react";
import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useConnexion } from "@/lib/useConnexion";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { useLangue, t } from "@/lib/i18n";
import { usePlanActuel } from "@/lib/plan/usePlanActuel";
import { supabase } from "@/lib/supabase/client";
import { TourGuide } from "@/components/TourGuide";
import { AccountPopup } from "@/components/AccountPopup";
import { useTourGuide } from "@/lib/onboarding/useTourGuide";
import { LimitePopup } from "@/components/LimitePopup";
import { useUsageMensuel } from "@/lib/plan/useUsageMensuel";

type DonneesAccueil = {
  ca: number;
  ventes: number;
  benefice: number;
  onTeDoit: number;
  tuDois: number;
  ventesRecentes: { nom: string; montant: number; source: "vocal" | "scan" | "manuel" }[];
  vocauxUtilises: number;
  scansUtilises: number;
};

const DONNEES_VIDES: DonneesAccueil = {
  ca: 0,
  ventes: 0,
  benefice: 0,
  onTeDoit: 0,
  tuDois: 0,
  ventesRecentes: [],
  vocauxUtilises: 0,
  scansUtilises: 0,
};

export default function Accueil() {
  const { colors } = useTheme();
  const enLigne = useConnexion();
  const { devise, formater } = useCurrency();
  const { langue } = useLangue();
  const { planId, plan } = usePlanActuel();
  const { vocauxUtilises, scansUtilises } = useUsageMensuel();
  const [nomBoutique, setNomBoutique] = useState("");
  const [chargement, setChargement] = useState(true);
  const [donnees, setDonnees] = useState<DonneesAccueil>(DONNEES_VIDES);
  const { afficherTour, terminerTour } = useTourGuide();
  const [afficherPopupCompte, setAfficherPopupCompte] = useState(true);
  const [limiteAffichee, setLimiteAffichee] = useState<"quota_vocal" | "quota_scan" | null>(null);

  useEffect(() => {
    chargerDonnees();
  }, []);

  async function chargerDonnees() {
    setChargement(true);

    const nom = await AsyncStorage.getItem("boutika_nom_boutique");
    if (nom) setNomBoutique(nom);

    // TODO : remplacer par de vraies requêtes Supabase/WatermelonDB.
    setDonnees(DONNEES_VIDES);
    setChargement(false);
    verifierAffichagePopupCompte();
  }
  async function verifierAffichagePopupCompte() {
    const dejaVu = await AsyncStorage.getItem("popup_compte_vu");
    if (dejaVu) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) return; // déjà un vrai compte, pas besoin d'inciter

    if (donnees.ventes >= 2) {
      setAfficherPopupCompte(true);
    }
  }

  const vocauxRestants = Math.max(0, (plan?.quotaVocal ?? 0) - vocauxUtilises);
  const scansRestants = Math.max(0, (plan?.quotaScan ?? 0) - scansUtilises);
  const desactive = !enLigne;
  const estPremium = planId === "premium";

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      {/* En-tête */}
      <View style={styles.entete}>
        <View>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "600" }}> {nomBoutique ? nomBoutique : <Text style={{ color: colors.textPrimary, fontSize: 15 }}>{t("shop_titre", langue)}</Text>
          } </Text>
        </View>
        <View style={styles.enteteDroite}>

          {!estPremium && (
            <Pressable onPress={() => router.push("/premium")} style={[styles.boutonPassePro, { backgroundColor: colors.proFill }]}>
              <Text style={{ color: colors.onPro, fontSize: 11 }}>{t("passer_pro", langue)}</Text>
            </Pressable>
          )}
          <Pressable onPress={() => router.push("/notifications")}>
            <Feather name="bell" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {chargement ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : (
        <>
          <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }}>{t("ca_aujourdhui", langue)}</Text>
            <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: "700", marginVertical: 4 }}>
              {formater(donnees.ca)}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t("aucune_vente_jour", langue)}</Text>
          </View>

          {/* Ventes / Bénéfice */}
          <View style={styles.ligneDeuxCartes}>
            <View style={[styles.cartePetite, { backgroundColor: colors.warningBg, borderColor: colors.border }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "500" }}>{t("ventes_du_jour", langue)}</Text>
              <Text style={{ color: colors.warning, fontSize: 18, fontWeight: "700" }}>{donnees.ventes}</Text>
            </View>
            <View style={[styles.cartePetite, { backgroundColor: colors.successBg, borderColor: colors.border }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "500" }}>{t("benefice_estime", langue)}</Text>
              <Text style={{ color: colors.success, fontSize: 18, fontWeight: "700" }}>{formater(donnees.benefice)}</Text>
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
              <Text style={{ color: colors.success, fontSize: 14, fontWeight: "700" }}>{formater(donnees.onTeDoit)}</Text>
            </Pressable>
            <Pressable style={styles.ligneCreance} onPress={() => router.push("/creances")}>
              <View style={styles.ligneGauche}>
                <Feather name="arrow-up-right" size={15} color={colors.danger} />
                <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{t("tu_dois", langue)}</Text>
              </View>
              <Text style={{ color: colors.danger, fontSize: 14, fontWeight: "700" }}>{formater(donnees.tuDois)}</Text>
            </Pressable>
          </View>

          {/* Bloc Premium */}
          <View
            style={[
              styles.barreAction,
              { borderColor: colors.borderPro, opacity: desactive ? 0.5 : 1, marginTop: 14 },
            ]}
          >
            <Text style={{ flex: 1, color: colors.pro, fontSize: 13 }}>{t("enregistrer_vente", langue)}</Text>
            <Pressable
              disabled={desactive}
              onPress={() => {
                if ((plan?.quotaScan ?? 0) === 0) {
                  router.push({ pathname: "/decouverte", params: { type: "scan" } }); // fonctionnalité totalement désactivée pour ce plan
                } else if (scansRestants <= 0) {
                  setLimiteAffichee("quota_scan"); // quota épuisé ce mois-ci
                } else {
                  router.push("/vente/scan"); // accès direct, quota disponible
                }
              }}
              style={[styles.boutonRondPro, { backgroundColor: colors.proFill }]}
            >
              <Feather name="camera" size={18} color={colors.onPro} />
              <View style={[styles.badgeEtoile, { backgroundColor: colors.background }]}>
                <Feather name="star" size={9} color={colors.pro} />
              </View>
            </Pressable>
            <Pressable
              disabled={desactive}
              onPress={() => {
                if ((plan?.quotaScan ?? 0) === 0) {
                  router.push({ pathname: "/decouverte", params: { type: "vocal" } }); // fonctionnalité totalement désactivée pour ce plan
                } else if (scansRestants <= 0) {
                  setLimiteAffichee("quota_vocal"); // quota épuisé ce mois-ci
                } else {
                  router.push("/vente/vocal"); // accès direct, quota disponible
                }
              }}
              style={[styles.boutonRondPro, { backgroundColor: colors.proFill }]}
            >
              <Feather name="mic" size={18} color={colors.onPro} />
              <View style={[styles.badgeEtoile, { backgroundColor: colors.background }]}>
                <Feather name="star" size={9} color={colors.pro} />
              </View>
            </Pressable>
          </View>



          {desactive && (
            <View style={styles.ligneInfo}>
              <Feather name="info" size={12} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>{t("connexion_requise", langue)}</Text>
            </View>
          )}

          {/* Saisie manuelle */}
          <Pressable
            style={[styles.boutonManuel, { backgroundColor: colors.accent, borderColor: colors.accent }]}
            onPress={() => router.push("/produit/nouveau")}
          >
            <Feather name="plus" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{t("ajouter_manuellement", langue)}</Text>
          </Pressable>

          {/* Ventes récentes */}
          <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 20 }]}>
            <View style={styles.enTeteVentes}>
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{t("ventes_recentes", langue)}</Text>
              <Pressable onPress={() => router.push("/commandes")}>
                <Text style={{ color: colors.accent, fontSize: 11 }}>{t("voir_tout", langue)}</Text>
              </Pressable>
            </View>
            {donnees.ventesRecentes.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t("aucune_vente_recente", langue)}</Text>
            ) : (
              donnees.ventesRecentes.map((v, i) => (
                <View key={i} style={styles.ligneCreance}>
                  <View style={styles.ligneGauche}>
                    <Feather
                      name={v.source === "vocal" ? "mic" : v.source === "scan" ? "camera" : "edit-3"}
                      size={13}
                      color={colors.textMuted}
                    />
                    <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{v.nom}</Text>
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{formater(v.montant)}</Text>
                </View>
              ))
            )}
          </View>
        </>
      )}

      <TourGuide visible={afficherTour} onTerminer={terminerTour} />
      <AccountPopup
        visible={afficherPopupCompte}
        onFermer={async () => {
          setAfficherPopupCompte(false);
          await AsyncStorage.setItem("popup_compte_vu", "true");
        }}
      />
      <LimitePopup
        visible={limiteAffichee !== null}
        type={limiteAffichee ?? "quota_vocal"}
        onFermer={() => setLimiteAffichee(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, paddingTop: 50 },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  enteteDroite: { flexDirection: "row", alignItems: "center", gap: 10 },
  pilleDevise: { flexDirection: "row", alignItems: "center", gap: 2, borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  badgeConnexion: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 20 },
  carte: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 12 },
  ligneDeuxCartes: { flexDirection: "row", gap: 10 },
  cartePetite: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 12 },
  ligneCreance: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  ligneGauche: { flexDirection: "row", alignItems: "center", gap: 8 },
  barreAction: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 24, padding: 8, paddingLeft: 16 },
  boutonRondPro: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", position: "relative" },
  badgeEtoile: { position: "absolute", top: -4, right: -4, width: 14, height: 14, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  bandeauPro: { flexDirection: "row", alignItems: "center", gap: 10, padding: 9, borderRadius: 10, marginTop: 8 },
  boutonPassePro: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  ligneInfo: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  boutonManuel: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 8, borderWidth: 1, marginVertical: 14 },
  enTeteVentes: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  enTeteCreances: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
});