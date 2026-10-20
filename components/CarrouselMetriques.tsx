
import { useRef, useState } from "react";
import { Animated, ImageBackground, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "@/components/Texte";
import { Skeleton } from "@/components/UI";
import { fondPremium } from "@/lib/theme/fonds";
import { useTheme } from "@/lib/theme/ThemeProvider";

type Metrique = { icone: keyof typeof Feather.glyphMap; libelle: string; valeur: string };

type Props = {
  chargement: boolean;
  // Page 1 : revenu + bénéfice du jour. Page 2 : produits vendus + ventes du jour.
  pages: [Metrique[], Metrique[]];
};

// Un seul bloc à fond d'image, deux pages qu'on fait glisser. Le texte est
// toujours blanc : le voile vert garde la lisibilité en mode clair comme sombre.
export function CarrouselMetriques({ chargement, pages }: Props) {
  const { isDark } = useTheme();
  const [largeur, setLargeur] = useState(0);
  const [page, setPage] = useState(0);
  const x = useRef(new Animated.Value(0)).current;

  function finDefilement(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (largeur > 0) setPage(Math.round(e.nativeEvent.contentOffset.x / largeur));
  }

  return (
    <View style={styles.boite} onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}>
      <ImageBackground source={fondPremium("welcome", true)} resizeMode="cover" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={isDark ? ["rgba(8,40,33,0.55)", "rgba(12,20,18,0.85)"] : ["rgba(20,145,122,0.55)", "rgba(11,61,51,0.85)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.cercleA} />
      <View style={styles.cercleB} />

      {largeur > 0 && (
        <Animated.ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x } } }], { useNativeDriver: true })}
          onMomentumScrollEnd={finDefilement}
          scrollEventThrottle={16}
          decelerationRate="fast"
        >
          {pages.map((metriques, i) => (
            <View key={i} style={[styles.page, { width: largeur }]}>
              {metriques.map((m) => (
                <View key={m.libelle} style={styles.colonne}>
                  <View style={styles.puce}>
                    <Feather name={m.icone} size={17} color="#fff" />
                  </View>
                  {chargement ? (
                    <Skeleton width="70%" height={26} style={{ marginTop: 14, backgroundColor: "rgba(255,255,255,0.22)" }} />
                  ) : (
                    <Text numberOfLines={1} adjustsFontSizeToFit style={styles.valeur}>{m.valeur}</Text>
                  )}
                  <Text numberOfLines={1} style={styles.libelle}>{m.libelle}</Text>
                </View>
              ))}
            </View>
          ))}
        </Animated.ScrollView>
      )}

      <View style={styles.points}>
        {[0, 1].map((i) => {
          const actif = page === i;
          return <View key={i} style={[styles.point, actif && styles.pointActif]} />;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  boite: { borderRadius: 22, overflow: "hidden", marginBottom: 12, minHeight: 150, backgroundColor: "#0B3D33" },
  page: { flexDirection: "row", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 34, gap: 18 },
  colonne: { flex: 1 },
  puce: { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  valeur: { color: "#fff", fontSize: 26, fontWeight: "800", marginTop: 12 },
  libelle: { color: "rgba(255,255,255,0.78)", fontSize: 12, fontWeight: "500", marginTop: 4 },
  points: { position: "absolute", bottom: 12, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  point: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.4)" },
  pointActif: { width: 18, backgroundColor: "#fff" },
  cercleA: { position: "absolute", width: 170, height: 170, borderRadius: 85, backgroundColor: "rgba(255,255,255,0.06)", top: -60, right: -40 },
  cercleB: { position: "absolute", width: 110, height: 110, borderRadius: 55, backgroundColor: "rgba(255,255,255,0.05)", bottom: -40, left: -20 },
});
