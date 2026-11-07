import { useEffect, useRef, useState } from "react";
import { Animated, Easing, ImageBackground, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/Texte";
import { Apparition, PressableAnime, useBalayage } from "@/components/anim";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { fondPremium } from "@/lib/theme/fonds";

export type PlanId = "gratuit" | "starter" | "premium";

type Meta = { nomCle: string; prixCle: string; prixJourCle?: string; descCle: string; fonctionnalitesCle: string; boutonCle: string; icone: keyof typeof Feather.glyphMap };

const META: Record<PlanId, Meta> = {
  gratuit: { nomCle: "plan_gratuit_nom", prixCle: "plan_gratuit_prix", descCle: "plan_gratuit_description", fonctionnalitesCle: "plan_gratuit_fonctionnalites", boutonCle: "bouton_plan_gratuit", icone: "gift" },
  starter: { nomCle: "plan_starter_nom", prixCle: "plan_starter_prix", prixJourCle: "plan_starter_prix_jour", descCle: "plan_starter_description", fonctionnalitesCle: "plan_starter_fonctionnalites", boutonCle: "bouton_plan_starter", icone: "zap" },
  premium: { nomCle: "plan_premium_nom", prixCle: "plan_premium_prix", prixJourCle: "plan_premium_prix_jour", descCle: "plan_premium_description", fonctionnalitesCle: "plan_premium_fonctionnalites", boutonCle: "bouton_plan_premium", icone: "award" },
};

// Écran « Plan » : UN SEUL bloc. Un sélecteur à onglets (avec pastille
// glissante) fait changer l'option affichée ; son prix, sa description et la
// liste de ses avantages apparaissent en cascade. Fond image plein écran.
export function EcranPlan({
  plans,
  planChoisi,
  onChoisir,
  prixParPlan,
  onContinuer,
  chargement,
  onRetour,
  onFermer,
  notes,
}: {
  plans: PlanId[];
  planChoisi: PlanId;
  onChoisir: (p: PlanId) => void;
  prixParPlan: Partial<Record<PlanId, number | null>>;
  onContinuer: () => void;
  chargement?: boolean;
  onRetour: () => void;
  onFermer?: () => void;
  notes?: string[];
}) {
  const { colors, isDark } = useTheme();
  // Palette selon le mode : texte clair sur fond sombre, texte foncé sur fond
  // clair ; le « verre » du bloc s'adapte aussi.
  const P = isDark
    ? { fond: "#0B1512", titre: "#FFFFFF", texte: "rgba(255,255,255,0.74)", doux: "rgba(255,255,255,0.55)", verre: "rgba(255,255,255,0.09)", bordure: "rgba(255,255,255,0.18)", piste: "rgba(0,0,0,0.28)", inactif: "rgba(255,255,255,0.62)", rond: "rgba(255,255,255,0.14)", icone: "#FFFFFF", sep: "rgba(255,255,255,0.18)", barre: "rgba(8,16,14,0.82)", voile: ["rgba(8,16,14,0)", "rgba(8,16,14,0.85)"] as [string, string], cocheT: "#7FF0D6", cocheP: "#C9C2FF" }
    : { fond: "#F6FBFA", titre: "#0E1A16", texte: "#3B4D49", doux: "#6B7C77", verre: "rgba(255,255,255,0.78)", bordure: "rgba(255,255,255,0.95)", piste: "rgba(14,26,22,0.07)", inactif: "#5B6C67", rond: "rgba(255,255,255,0.75)", icone: "#0E1A16", sep: "rgba(14,26,22,0.10)", barre: "rgba(250,254,253,0.9)", voile: ["rgba(246,251,250,0)", "rgba(246,251,250,0.92)"] as [string, string], cocheT: "#0E7A66", cocheP: "#4B3FBF" };
  const { langue } = useLangue();
  const { formater } = useCurrency();
  const insets = useSafeAreaInsets();
  const meta = META[planChoisi];
  const estPremium = planChoisi === "premium";

  // Pastille glissante du sélecteur.
  const [largeurSelecteur, setLargeurSelecteur] = useState(0);
  const index = Math.max(0, plans.indexOf(planChoisi));
  const glisse = useRef(new Animated.Value(index)).current;
  useEffect(() => {
    Animated.spring(glisse, { toValue: index, useNativeDriver: true, speed: 16, bounciness: 8 }).start();
  }, [index, glisse]);
  const largeurSegment = largeurSelecteur > 0 ? (largeurSelecteur - 8) / plans.length : 0;

  // Fondu du contenu à chaque changement d'option.
  const fondu = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    fondu.setValue(0);
    Animated.timing(fondu, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [planChoisi, fondu]);

  const balayage = useBalayage();
  const prix = prixParPlan[planChoisi];
  const fonctionnalites = t(meta.fonctionnalitesCle as any, langue) as unknown as string[];
  const degradeBouton: [string, string] = estPremium ? ["#8B7CFF", "#5B4BE0"] : ["#2FD0AE", "#14917A"];

  return (
    <View style={{ flex: 1, backgroundColor: P.fond }}>
      <ImageBackground source={fondPremium("plan", isDark)} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient colors={P.voile} style={[StyleSheet.absoluteFill, { top: "45%" }]} pointerEvents="none" />

      <View style={[styles.entete, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onRetour} hitSlop={10} style={[styles.rond, { backgroundColor: P.rond }]}>
          <Feather name="arrow-left" size={20} color={P.icone} />
        </Pressable>
        {onFermer ? (
          <Pressable onPress={onFermer} hitSlop={10} style={[styles.rond, { backgroundColor: P.rond }]}>
            <Feather name="x" size={20} color={P.icone} />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.contenu} showsVerticalScrollIndicator={false}>
        <Apparition>
          <Text style={[styles.titre, { color: P.titre }]}>{t("plan_titre", langue)}</Text>
          <Text style={[styles.sousTitre, { color: P.texte }]}>{t("plan_sous_titre", langue)}</Text>
        </Apparition>

        <Apparition delai={120} style={[styles.bloc, { backgroundColor: P.verre, borderColor: P.bordure }, !isDark && { shadowColor: "#0B2A22", shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 6 }]}>
          {/* Sélecteur à onglets */}
          <View style={[styles.selecteur, { backgroundColor: P.piste }]} onLayout={(e) => setLargeurSelecteur(e.nativeEvent.layout.width)}>
            {largeurSegment > 0 && (
              <Animated.View
                style={[
                  styles.pastille,
                  { width: largeurSegment, backgroundColor: estPremium ? "#6C5CE7" : "#14917A", transform: [{ translateX: Animated.multiply(glisse, largeurSegment) }] },
                ]}
              />
            )}
            {plans.map((p) => (
              <Pressable key={p} onPress={() => onChoisir(p)} style={styles.segment}>
                <Text style={[styles.segmentTexte, { color: p === planChoisi ? "#fff" : P.inactif }]}>{t(META[p].nomCle as any, langue)}</Text>
              </Pressable>
            ))}
          </View>

          <Animated.View style={{ opacity: fondu, transform: [{ translateY: fondu.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
            <View style={styles.ligneNom}>
              <View style={[styles.iconePlan, { backgroundColor: estPremium ? "rgba(108,92,231,0.35)" : "rgba(37,175,147,0.3)" }]}>
                <Feather name={meta.icone} size={20} color={isDark ? "#fff" : estPremium ? "#4B3FBF" : "#0E7A66"} />
              </View>
              {estPremium && plans.length > 1 && (
                <View style={styles.badgePopulaire}>
                  <Text style={styles.badgeTexte}>{t("plan_populaire", langue)}</Text>
                </View>
              )}
            </View>

            {/* Prix : base de données si dispo, sinon texte traduit de repli. */}
            {planChoisi !== "gratuit" && prix != null ? (
              <View style={styles.lignePrix}>
                <Text style={[styles.prix, { color: P.titre }]}>{formater(prix)}</Text>
                <Text style={[styles.periode, { color: P.texte }]}> / {t("mois_title", langue)}</Text>
                <Text style={[styles.prixJour, { color: P.doux }]}>  ≈ {formater(Math.round(prix / 30))} / {t("jour_title", langue)}</Text>
              </View>
            ) : (
              <View style={styles.lignePrix}>
                <Text style={[styles.prix, { color: P.titre }]}>{t(meta.prixCle as any, langue)}</Text>
                {meta.prixJourCle ? <Text style={[styles.prixJour, { color: P.doux }]}>  {t(meta.prixJourCle as any, langue)}</Text> : null}
              </View>
            )}
            <Text style={[styles.description, { color: P.texte }]}>{t(meta.descCle as any, langue)}</Text>

            <View style={[styles.separateur, { backgroundColor: P.sep }]} />

            {fonctionnalites.map((f, i) => (
              <Apparition key={`${planChoisi}-${i}`} delai={60 + i * 45} duree={380} depuis={10}>
                <View style={styles.ligneFonction}>
                  <View style={[styles.coche, { backgroundColor: estPremium ? "rgba(139,124,255,0.28)" : "rgba(47,208,174,0.25)" }]}>
                    <Feather name="check" size={12} color={estPremium ? P.cocheP : P.cocheT} />
                  </View>
                  <Text style={[styles.fonctionTexte, { color: P.titre }]}>{f}</Text>
                </View>
              </Apparition>
            ))}
          </Animated.View>
        </Apparition>

        {(notes ?? []).map((n) => (
          <Text key={n} style={[styles.note, { color: P.doux }]}>{n}</Text>
        ))}
      </ScrollView>

      <View style={[styles.bas, { backgroundColor: P.barre, paddingBottom: Math.max(insets.bottom, 14) + 8 }]}>
        <PressableAnime onPress={onContinuer} disabled={chargement} style={{ opacity: chargement ? 0.7 : 1 }}>
          <LinearGradient colors={degradeBouton} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bouton}>
            <Text style={styles.boutonTexte}>{chargement ? "…" : t(meta.boutonCle as any, langue)}</Text>
            <Feather name="arrow-right" size={18} color="#fff" style={{ marginLeft: 8 }} />
            {/* Reflet qui traverse le bouton */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.reflet,
                { transform: [{ translateX: balayage.interpolate({ inputRange: [0, 1], outputRange: [-120, 420] }) }, { skewX: "-20deg" }] },
              ]}
            />
          </LinearGradient>
        </PressableAnime>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 18, paddingBottom: 4 },
  rond: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  contenu: { padding: 20, paddingBottom: 130 },
  titre: { color: "#fff", fontSize: 30, fontWeight: "800", letterSpacing: -0.6 },
  sousTitre: { color: "rgba(255,255,255,0.72)", fontSize: 14, marginTop: 6, marginBottom: 22, lineHeight: 20 },
  bloc: { backgroundColor: "rgba(255,255,255,0.09)", borderColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderRadius: 26, padding: 14 },
  selecteur: { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.28)", borderRadius: 18, padding: 4, marginBottom: 18 },
  pastille: { position: "absolute", top: 4, bottom: 4, left: 4, borderRadius: 14 },
  segment: { flex: 1, paddingVertical: 11, alignItems: "center" },
  segmentTexte: { fontSize: 14, fontWeight: "700" },
  ligneNom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6 },
  iconePlan: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  badgePopulaire: { backgroundColor: "#F5B942", paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20 },
  badgeTexte: { color: "#2A1D00", fontSize: 11, fontWeight: "800" },
  lignePrix: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", paddingHorizontal: 6, marginTop: 14 },
  prix: { color: "#fff", fontSize: 32, fontWeight: "800", letterSpacing: -0.8 },
  periode: { color: "rgba(255,255,255,0.8)", fontSize: 15, fontWeight: "600" },
  prixJour: { color: "rgba(255,255,255,0.55)", fontSize: 12 },
  description: { color: "rgba(255,255,255,0.76)", fontSize: 13.5, lineHeight: 20, paddingHorizontal: 6, marginTop: 8 },
  separateur: { height: StyleSheet.hairlineWidth * 2, backgroundColor: "rgba(255,255,255,0.18)", marginVertical: 16, marginHorizontal: 6 },
  ligneFonction: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 7, paddingHorizontal: 6 },
  coche: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  fonctionTexte: { color: "#fff", fontSize: 13.5, flex: 1, lineHeight: 19 },
  note: { color: "rgba(255,255,255,0.6)", fontSize: 12, textAlign: "center", marginTop: 16, lineHeight: 18, paddingHorizontal: 8 },
  bas: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 14, backgroundColor: "rgba(8,16,14,0.82)" },
  bouton: { height: 56, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  boutonTexte: { color: "#fff", fontSize: 16, fontWeight: "800" },
  reflet: { position: "absolute", top: -10, bottom: -10, width: 50, backgroundColor: "rgba(255,255,255,0.28)" },
});
