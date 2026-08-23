import { useRef, useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Dimensions, NativeSyntheticEvent, NativeScrollEvent, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LARGEUR = Dimensions.get("window").width;

type Teinte = "accent" | "success" | "pro";
const SLIDES: { titreCle: string; descCle: string; teinte: Teinte }[] = [
  { titreCle: "slide1_titre", descCle: "slide1_description", teinte: "accent" },
  { titreCle: "slide2_titre", descCle: "slide2_description", teinte: "success" },
  { titreCle: "slide3_titre", descCle: "slide3_description", teinte: "pro" },
];

export default function OnboardingSlides() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const [indexActif, setIndexActif] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const [chargement, setChargement] = useState(false);
  const [nomBoutique, setNomBoutique] = useState("");

  useEffect(() => {
    AsyncStorage.getItem("boutika_nom_boutique").then((valeur) => {
      if (valeur) setNomBoutique(valeur);
    });
  }, []);

  function surScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndexActif(Math.round(e.nativeEvent.contentOffset.x / LARGEUR));
  }

  async function suivant() {
    if (indexActif < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: LARGEUR * (indexActif + 1), animated: true });
    } else {
      await terminerOnboarding();
    }
  }

  function terminerOnboarding() {
    router.replace("/onboarding/boutique");
  }

  function couleursTeinte(teinte: Teinte) {
    if (teinte === "success") return { fond: colors.successBg, forte: colors.success, onForte: colors.background };
    if (teinte === "pro") return { fond: colors.proBg, forte: colors.proFill, onForte: colors.onPro };
    return { fond: colors.accentBg, forte: colors.accent, onForte: colors.background };
  }

  const teinteActive = couleursTeinte(SLIDES[indexActif].teinte);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>

      <ScrollView ref={scrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={surScroll}>
        {SLIDES.map((slide, i) => (
          <View key={slide.titreCle} style={[styles.slide, { width: LARGEUR }]}>
            {i === 0 && <AperçuHorsLigne colors={colors} langue={langue} nomBoutique={nomBoutique} />}
            {i === 1 && <AperçuStock colors={colors} langue={langue} />}
            {i === 2 && <AperçuCreances colors={colors} langue={langue} />}

            <Text style={{ fontSize: 21, fontWeight: "700", color: colors.textPrimary, textAlign: "center", marginTop: 28, marginBottom: 10 }}>
              {t(slide.titreCle as any, langue)}
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 22, paddingHorizontal: 10 }}>
              {t(slide.descCle as any, langue)}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.barreProgression}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.segment, { backgroundColor: i <= indexActif ? teinteActive.forte : colors.border, opacity: i <= indexActif ? 1 : 0.5 }]} />
        ))}
      </View>

      <View style={styles.bas}>
        <Pressable onPress={terminerOnboarding} disabled={chargement}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("slide_passer", langue)}</Text>
        </Pressable>
        <Pressable
          onPress={suivant}
          disabled={chargement}
          style={[styles.boutonSuivant, { backgroundColor: teinteActive.forte, opacity: chargement ? 0.7 : 1 }]}
        >
          {chargement ? (
            <ActivityIndicator size="small" color={teinteActive.onForte} />
          ) : (
            <>
              <Text style={{ color: teinteActive.onForte, fontSize: 14, fontWeight: "600" }}>
                {indexActif === SLIDES.length - 1 ? t("continuer", langue) : t("slide_suivant", langue)}
              </Text>
              <Feather name="arrow-right" size={16} color={teinteActive.onForte} />
            </>
          )}
        </Pressable>
      </View>

      {/* Dégradé de bas d'écran, dans la teinte de la slide active */}
      <LinearGradient
        colors={[`${teinteActive.forte}00`, `${teinteActive.forte}22`]}
        style={styles.degrade}
        pointerEvents="none"
      />
    </View>
  );
}

// --- Aperçus mockup pour chaque slide ---

function CarteTelephone({ colors, children }: any) {
  return (
    <View style={[styles.carteTelephone, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

function AperçuHorsLigne({ colors, langue, nomBoutique }: any) {
  const nomAffiche = nomBoutique || t("apercu_nom_boutique", langue);

  return (
    <View style={{ position: "relative" }}>
      <CarteTelephone colors={colors}>
        <View style={styles.ligneEnTeteApercu}>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>{nomAffiche}</Text>
          <View style={[styles.badgeApercu, { backgroundColor: colors.warningBg }]}>
            <Feather name="wifi-off" size={11} color={colors.warning} />
            <Text style={{ fontSize: 10, color: colors.warning }}>{t("apercu_hors_ligne", langue)}</Text>
          </View>
        </View>
        <View style={[styles.blocApercu, { backgroundColor: colors.background }]}>
          <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}>{t("apercu_ca_aujourdhui", langue)}</Text>
          <Text style={{ fontSize: 19, fontWeight: "600", color: colors.textPrimary }}>45 000 FCFA</Text>
        </View>
        <View style={[styles.blocApercuLigne, { backgroundColor: colors.background }]}>
          <Feather name="database" size={13} color={colors.textMuted} />
          <Text style={{ fontSize: 10, color: colors.textSecondary }}>{t("apercu_donnees_locales", langue)}</Text>
        </View>
      </CarteTelephone>
      <View style={[styles.badgeFlottant, { backgroundColor: colors.success }]}>
        <Feather name="check" size={16} color={colors.background} />
      </View>
    </View>
  );
}

function AperçuStock({ colors, langue }: any) {
  return (
    <CarteTelephone colors={colors}>
      <View style={styles.ligneProduitApercu}>
        <Text style={{ fontSize: 12, color: colors.textPrimary }}>{t("apercu_produit_riz", langue)}</Text>
        <Text style={{ fontSize: 12, fontWeight: "500", color: colors.textPrimary }}>22 {t("apercu_en_stock", langue)}</Text>
      </View>
      <View style={[styles.ligneProduitApercu, { backgroundColor: colors.warningBg, marginHorizontal: -14, paddingHorizontal: 14, borderRadius: 8 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Feather name="alert-triangle" size={12} color={colors.warning} />
          <Text style={{ fontSize: 12, color: colors.textPrimary }}>{t("apercu_produit_savon", langue)}</Text>
        </View>
        <Text style={{ fontSize: 11, color: colors.warning }}>{t("apercu_stock_faible", langue)}</Text>
      </View>
      <View style={[styles.blocApercuLigne, { backgroundColor: colors.background, marginTop: 4 }]}>
        <Feather name="package" size={13} color={colors.textMuted} />
        <Text style={{ fontSize: 10, color: colors.textSecondary }}>2 produits suivis</Text>
      </View>
    </CarteTelephone>
  );
}

function AperçuCreances({ colors, langue }: any) {
  return (
    <View style={{ position: "relative" }}>
      <CarteTelephone colors={colors}>
        <View style={[styles.carteCreanceApercu, { backgroundColor: colors.dangerBg }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: "500", color: colors.textPrimary }}>{t("apercu_creance_nom", langue)}</Text>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textPrimary }}>{t("apercu_creance_montant", langue)}</Text>
          </View>
          <Text style={{ fontSize: 11, color: colors.danger }}>{t("apercu_creance_retard", langue)}</Text>
        </View>
        <View style={[styles.blocApercuLigne, { backgroundColor: colors.background, marginTop: 10 }]}>
          <Feather name="bar-chart-2" size={13} color={colors.textMuted} />
          <Text style={{ fontSize: 10, color: colors.textSecondary }}>Rapport mensuel disponible</Text>
        </View>
      </CarteTelephone>
      <View style={[styles.badgeFlottant, { backgroundColor: colors.pro }]}>
        <Feather name="trending-up" size={16} color={colors.onPro} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slide: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },

  carteTelephone: { width: "100%", borderRadius: 20, borderWidth: 1, padding: 16 },
  ligneEnTeteApercu: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  badgeApercu: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  blocApercu: { borderRadius: 12, padding: 12, marginBottom: 10 },
  blocApercuLigne: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10 },
  ligneProduitApercu: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  carteCreanceApercu: { borderRadius: 12, padding: 12 },
  badgeFlottant: { position: "absolute", top: -14, right: 10, width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  barreProgression: { flexDirection: "row", gap: 6, paddingHorizontal: 32, marginBottom: 24 },
  segment: { flex: 1, height: 4, borderRadius: 2 },

  bas: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingBottom: 40, zIndex: 2 },
  boutonSuivant: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 24 },

  degrade: { position: "absolute", bottom: 0, left: 0, right: 0, height: 220, zIndex: 0 },
});