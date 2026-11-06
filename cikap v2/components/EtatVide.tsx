import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "@/components/Texte";
import { Apparition, PressableAnime } from "@/components/anim";
import { Skeleton } from "@/components/UI";
import { useTheme } from "@/lib/theme/ThemeProvider";

// État vide soigné : grande pastille dégradée qui flotte doucement, titre clair,
// phrase d'aide et (optionnel) bouton d'action directe.
export function EtatVide({
  icone,
  titre,
  texte,
  actionLibelle,
  onAction,
}: {
  icone: keyof typeof Feather.glyphMap;
  titre: string;
  texte?: string;
  actionLibelle?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  const flottement = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.timing(flottement, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(flottement, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    boucle.start();
    return () => boucle.stop();
  }, [flottement]);

  return (
    <Apparition style={styles.conteneur}>
      <Animated.View style={{ transform: [{ translateY: flottement.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) }] }}>
        <View style={[styles.halo, { backgroundColor: colors.accentBg }]}>
          <LinearGradient colors={[colors.accentClair, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pastille}>
            <Feather name={icone} size={30} color="#fff" />
          </LinearGradient>
        </View>
      </Animated.View>
      <Text style={[styles.titre, { color: colors.textPrimary }]}>{titre}</Text>
      {texte ? <Text style={[styles.texte, { color: colors.textSecondary }]}>{texte}</Text> : null}
      {actionLibelle && onAction ? (
        <PressableAnime onPress={onAction} style={{ marginTop: 20 }}>
          <LinearGradient colors={[colors.accentClair, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bouton}>
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.boutonTexte}>{actionLibelle}</Text>
          </LinearGradient>
        </PressableAnime>
      ) : null}
    </Apparition>
  );
}

// Chargement de liste : lignes fantômes qui pulsent, plutôt qu'un spinner seul.
export function ListeSkeleton({ lignes = 6 }: { lignes?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingHorizontal: 2, paddingTop: 8, gap: 10 }}>
      {Array.from({ length: lignes }).map((_, i) => (
        <View key={i} style={[styles.ligneSkel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Skeleton width={40} height={40} style={{ borderRadius: 12 }} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="55%" height={13} />
            <Skeleton width="35%" height={10} />
          </View>
          <Skeleton width={56} height={14} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { alignItems: "center", paddingTop: 56, paddingHorizontal: 32 },
  halo: { width: 112, height: 112, borderRadius: 56, alignItems: "center", justifyContent: "center" },
  pastille: { width: 76, height: 76, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  titre: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3, marginTop: 22, textAlign: "center" },
  texte: { fontSize: 13.5, lineHeight: 20, textAlign: "center", marginTop: 8, maxWidth: 300 },
  bouton: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 22, height: 48, borderRadius: 16 },
  boutonTexte: { color: "#fff", fontSize: 14.5, fontWeight: "800" },
  ligneSkel: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 16, padding: 12 },
});
