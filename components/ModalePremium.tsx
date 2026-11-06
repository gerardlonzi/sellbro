import { useEffect, useRef } from "react";
import { Animated, Easing, ImageBackground, Modal, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { Text } from "@/components/Texte";
import { Apparition, PressableAnime, useBalayage, usePulsation } from "@/components/anim";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { fondPremium } from "@/lib/theme/fonds";

type Avantage = { icone: keyof typeof Feather.glyphMap; texte: string };
// Carte d'offre (ex. Starter / Premium) avec son prix, affichée sous le texte.
export type OffrePopup = { id: string; nom: string; prix: string; suffixe?: string; badge?: string; surligne?: boolean };

// Popup « premium » commune à la bienvenue, aux rappels d'essai, à
// l'expiration et au paywall : image de fond plein cadre en tête, pastille
// d'icône qui pulse, entrée en ressort, bouton principal avec reflet.
export function ModalePremium({
  visible,
  fond,
  icone,
  teinte = "accent",
  titre,
  texte,
  sousTexte,
  avantages,
  offres,
  libellePrincipal,
  libelleSecondaire,
  onPrincipal,
  onSecondaire,
}: {
  visible: boolean;
  fond: "welcome" | "paywall";
  icone: keyof typeof Feather.glyphMap;
  teinte?: "accent" | "pro" | "danger";
  titre: string;
  texte: string;
  sousTexte?: string;
  avantages?: Avantage[];
  offres?: OffrePopup[];
  libellePrincipal: string;
  libelleSecondaire: string;
  onPrincipal: () => void;
  onSecondaire: () => void;
}) {
  const { colors, isDark } = useTheme();
  const entree = useRef(new Animated.Value(0)).current;
  const halo = usePulsation(visible, 1500, 0, 1);
  const balayage = useBalayage();

  useEffect(() => {
    if (visible) {
      entree.setValue(0);
      Animated.spring(entree, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 9 }).start();
    }
  }, [visible, entree]);

  const couleursBouton: [string, string] =
    teinte === "pro" ? ["#8B7CFF", "#5B4BE0"] : teinte === "danger" ? ["#F0746E", "#D64545"] : ["#2FD0AE", "#14917A"];
  const couleurIcone = teinte === "pro" ? "#8B7CFF" : teinte === "danger" ? "#F0746E" : "#2FD0AE";

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onSecondaire}>
      <Animated.View style={[styles.fond, { opacity: entree.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onSecondaire} />
        <Animated.View
          style={[
            styles.carte,
            {
              backgroundColor: colors.surface,
              transform: [
                { scale: entree.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
                { translateY: entree.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
              ],
            },
          ]}
        >
          <ImageBackground
            source={fondPremium(fond, isDark)}
            style={styles.hero}
            resizeMode="cover"
          >
            <Animated.View
              style={[
                styles.halo,
                {
                  backgroundColor: couleurIcone,
                  opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
                  transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.9] }) }],
                },
              ]}
            />
            <View style={[styles.pastille, { borderColor: "rgba(255,255,255,0.55)" }]}>
              <Feather name={icone} size={30} color="#fff" />
            </View>
            <Pressable onPress={onSecondaire} hitSlop={12} style={styles.fermer}>
              <Feather name="x" size={18} color="#fff" />
            </Pressable>
          </ImageBackground>

          <View style={styles.corps}>
            <Apparition delai={140} duree={380}>
              <Text style={[styles.titre, { color: colors.textPrimary }]}>{titre}</Text>
              <Text style={[styles.texte, { color: colors.textSecondary }]}>{texte}</Text>
              {sousTexte ? <Text style={[styles.sousTexte, { color: colors.textPrimary }]}>{sousTexte}</Text> : null}
            </Apparition>

            {offres && offres.length > 0 && (
              <Apparition delai={200} duree={380}>
                <View style={styles.offres}>
                  {offres.map((o) => (
                    <View
                      key={o.id}
                      style={[
                        styles.offre,
                        {
                          backgroundColor: o.surligne ? colors.proBg : colors.background,
                          borderColor: o.surligne ? colors.pro : colors.border,
                          borderWidth: o.surligne ? 1.5 : 1,
                        },
                      ]}
                    >
                      {o.badge ? (
                        <View style={[styles.badgeOffre, { backgroundColor: colors.proFill }]}>
                          <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.4 }}>{o.badge}</Text>
                        </View>
                      ) : null}
                      <Text style={{ color: o.surligne ? colors.pro : colors.textSecondary, fontSize: 12, fontWeight: "700" }}>{o.nom}</Text>
                      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "800", marginTop: 4 }}>{o.prix}</Text>
                      {o.suffixe ? <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}>{o.suffixe}</Text> : null}
                    </View>
                  ))}
                </View>
              </Apparition>
            )}

            {avantages && avantages.length > 0 && (
              <View style={{ marginTop: 14, gap: 8 }}>
                {avantages.map((a, i) => (
                  <Apparition key={a.texte} delai={260 + i * 80} duree={360} depuis={10}>
                    <View style={styles.ligneAvantage}>
                      <View style={[styles.iconeAvantage, { backgroundColor: teinte === "pro" ? colors.proBg : colors.accentBg }]}>
                        <Feather name={a.icone} size={15} color={teinte === "pro" ? colors.pro : colors.accent} />
                      </View>
                      <Text style={{ color: colors.textPrimary, fontSize: 13.5, fontWeight: "500", flex: 1 }}>{a.texte}</Text>
                    </View>
                  </Apparition>
                ))}
              </View>
            )}

            <View style={{ marginTop: 20, gap: 4 }}>
              <PressableAnime onPress={onPrincipal} echelle={0.97}>
                <LinearGradient colors={couleursBouton} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.boutonPrincipal}>
                  <Text numberOfLines={1} style={styles.boutonTexte}>{libellePrincipal}</Text>
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.reflet, { transform: [{ translateX: balayage.interpolate({ inputRange: [0, 1], outputRange: [-100, 380] }) }, { skewX: "-20deg" }] }]}
                  />
                </LinearGradient>
              </PressableAnime>
              <Pressable onPress={onSecondaire} style={styles.boutonSecondaire}>
                <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: "600" }}>{libelleSecondaire}</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: "rgba(4,10,8,0.7)", alignItems: "center", justifyContent: "center", padding: 22 },
  carte: { width: "100%", maxWidth: 380, borderRadius: 28, overflow: "hidden", elevation: 24, shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 30, shadowOffset: { width: 0, height: 16 } },
  hero: { height: 150, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 84, height: 84, borderRadius: 42 },
  pastille: { width: 74, height: 74, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.22)", borderWidth: 1, alignItems: "center", justifyContent: "center" },
  fermer: { position: "absolute", top: 14, right: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center" },
  corps: { padding: 22, paddingTop: 20 },
  titre: { fontSize: 21, fontWeight: "800", letterSpacing: -0.4, textAlign: "center" },
  texte: { fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8 },
  sousTexte: { fontSize: 13, fontWeight: "600", textAlign: "center", marginTop: 10 },
  offres: { flexDirection: "row", gap: 10, marginTop: 16 },
  offre: { flex: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 10, alignItems: "center" },
  badgeOffre: { position: "absolute", top: -9, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  ligneAvantage: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconeAvantage: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  boutonPrincipal: { height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  boutonTexte: { color: "#fff", fontSize: 15.5, fontWeight: "800" },
  reflet: { position: "absolute", top: -10, bottom: -10, width: 46, backgroundColor: "rgba(255,255,255,0.28)" },
  boutonSecondaire: { height: 44, alignItems: "center", justifyContent: "center" },
});
