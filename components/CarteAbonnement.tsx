import { useEffect, useRef } from "react";
import { Animated, Easing, ImageBackground, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Text } from "@/components/Texte";
import { PressableAnime } from "@/components/anim";
import { fondPremium } from "@/lib/theme/fonds";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { usePlanActuel } from "@/lib/plan/usePlanActuel";
import { useEssai } from "@/lib/trial/useEssai";
import { useAbonnement } from "@/lib/plan/useAbonnement";

// Carte d'abonnement des réglages : fond d'image, plan courant, jours restants
// avec une jauge animée, et le bouton adapté à la situation
// (essai → voir les offres, Starter → passer à Premium, expiré → renouveler).
export function CarteAbonnement() {
  const { isDark } = useTheme();
  const { langue } = useLangue();
  const { planId } = usePlanActuel();
  const essai = useEssai();
  const { expire, joursRestants } = useAbonnement();

  const pret = essai.pret && essai.planVerifie;
  const payant = planId === "starter" || planId === "premium";
  const premium = planId === "premium";

  let nom = t("abo_gratuit_nom", langue);
  let icone: keyof typeof Feather.glyphMap = "gift";
  let ligne = "";
  let info = t("abo_gratuit_info", langue);
  let jours: number | null = null;
  let total = 30;
  let cta: string | null = t("abo_voir_offres", langue);
  let danger = false;

  if (payant && !expire) {
    nom = premium ? t("abo_premium_nom", langue) : t("abo_starter_nom", langue);
    icone = premium ? "award" : "zap";
    ligne = t("abo_expire_dans", langue)(joursRestants);
    info = premium ? t("abo_premium_info", langue) : t("abo_starter_info", langue);
    jours = joursRestants;
    cta = premium ? null : t("paywall_ia_bouton", langue);
  } else if (essai.actif) {
    nom = t("abo_essai_nom", langue);
    icone = "star";
    ligne = t("essai_actif_reste", langue)(essai.joursRestants);
    jours = essai.joursRestants;
    total = essai.dureeTotale ?? Math.max(essai.joursRestants, 7);
    info = t("abo_premium_info", langue);
  } else if (expire) {
    nom = t("abonnement_termine_statut", langue);
    icone = "alert-circle";
    ligne = t("paywall_message_abonnement", langue);
    info = "";
    cta = t("abonnement_termine_renew", langue);
    danger = true;
  } else {
    ligne = t("essai_termine_statut", langue);
    danger = true;
  }

  const progression = useRef(new Animated.Value(0)).current;
  const ratio = jours != null ? Math.max(0.04, Math.min(1, jours / Math.max(total, 1))) : 0;
  useEffect(() => {
    Animated.timing(progression, { toValue: ratio, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [ratio, progression]);

  if (!pret) {
    return <View style={[styles.carte, { backgroundColor: "#0B3D33", opacity: 0.6 }]} />;
  }

  return (
    <View style={styles.carte}>
      <ImageBackground source={fondPremium("plan", true)} resizeMode="cover" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={danger ? ["rgba(120,30,30,0.55)", "rgba(20,8,8,0.85)"] : isDark ? ["rgba(8,40,33,0.35)", "rgba(10,18,16,0.85)"] : ["rgba(20,145,122,0.4)", "rgba(11,61,51,0.88)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.contenu}>
        <View style={styles.entete}>
          <View style={styles.puce}>
            <Feather name={icone} size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nom}>{nom}</Text>
            {ligne ? <Text style={styles.ligne} numberOfLines={2}>{ligne}</Text> : null}
          </View>
          {payant && !expire ? (
            <View style={styles.pastilleActive}>
              <View style={styles.point} />
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{t("premium_puce_active", langue)}</Text>
            </View>
          ) : null}
        </View>

        {jours != null ? (
          <View style={styles.jauge}>
            <Animated.View style={[styles.jaugeRemplie, { width: progression.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]} />
          </View>
        ) : null}

        {info ? <Text style={styles.info}>{info}</Text> : null}

        {cta ? (
          <PressableAnime onPress={() => router.push("/premium")} style={{ marginTop: 14 }}>
            <View style={[styles.bouton, { backgroundColor: danger ? "#fff" : "#fff" }]}>
              <Text style={{ color: danger ? "#B42318" : "#0B3D33", fontSize: 14, fontWeight: "800" }}>{cta}</Text>
              <Feather name="arrow-right" size={16} color={danger ? "#B42318" : "#0B3D33"} />
            </View>
          </PressableAnime>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: 24, overflow: "hidden", marginBottom: 16, minHeight: 120, backgroundColor: "#0B3D33" },
  contenu: { padding: 18 },
  entete: { flexDirection: "row", alignItems: "center", gap: 12 },
  puce: { width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  nom: { color: "#fff", fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  ligne: { color: "rgba(255,255,255,0.8)", fontSize: 12.5, marginTop: 2 },
  pastilleActive: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  point: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#5CF0C8" },
  jauge: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.2)", marginTop: 16, overflow: "hidden" },
  jaugeRemplie: { height: 6, borderRadius: 3, backgroundColor: "#5CF0C8" },
  info: { color: "rgba(255,255,255,0.78)", fontSize: 12.5, lineHeight: 18, marginTop: 12 },
  bouton: { height: 46, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
