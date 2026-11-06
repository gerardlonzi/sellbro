import { useEffect, useRef } from "react";
import { View, Pressable, Animated, StyleSheet, ViewStyle, DimensionValue, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { Feather } from "@expo/vector-icons";
import { Text } from "@/components/Texte";
import { PressableAnime } from "@/components/anim";

// Ombre douce commune : profondeur discrète en clair, quasi invisible en
// sombre (c'est la bordure qui structure alors la carte).
export function ombre(colors: { ombre: string }, niveau: 1 | 2 | 3 = 1): ViewStyle {
  const n = { 1: { o: 0.06, r: 8, y: 2, e: 2 }, 2: { o: 0.1, r: 16, y: 6, e: 5 }, 3: { o: 0.16, r: 28, y: 12, e: 12 } }[niveau];
  return Platform.select<ViewStyle>({
    ios: { shadowColor: colors.ombre, shadowOpacity: n.o, shadowRadius: n.r, shadowOffset: { width: 0, height: n.y } },
    default: { elevation: n.e, shadowColor: colors.ombre },
  }) as ViewStyle;
}

export function Carte({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border }, ombre(colors, 1), style]}>
      {children}
    </View>
  );
}

export function Badge({ texte, type = "neutre" }: { texte: string; type?: "succes" | "attention" | "danger" | "pro" | "neutre" }) {
  const { colors } = useTheme();
  const paires = {
    succes: { bg: colors.successBg, fg: colors.success },
    attention: { bg: colors.warningBg, fg: colors.warning },
    danger: { bg: colors.dangerBg, fg: colors.danger },
    pro: { bg: colors.proBg, fg: colors.pro },
    neutre: { bg: colors.surface, fg: colors.textSecondary },
  }[type];
  return (
    <View style={[styles.badge, { backgroundColor: paires.bg }]}>
      <Text style={{ color: paires.fg, fontSize: 11, fontWeight: "600" }}>{texte}</Text>
    </View>
  );
}

// Bouton principal : dégradé teal, rebond à l'appui, ombre colorée.
export function BoutonPrimaire({
  texte,
  onPress,
  disabled,
  couleur,
  icone,
}: {
  texte: string;
  onPress: () => void;
  disabled?: boolean;
  couleur?: string;
  icone?: keyof typeof Feather.glyphMap;
}) {
  const { colors } = useTheme();
  const debut = couleur ?? colors.accentClair;
  const fin = couleur ?? colors.accent;
  return (
    <PressableAnime onPress={onPress} disabled={disabled} echelle={0.97} style={{ opacity: disabled ? 0.5 : 1 }}>
      <LinearGradient
        colors={[debut, fin]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.bouton, !disabled && { shadowColor: fin, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 }]}
      >
        {icone && <Feather name={icone} size={16} color="#fff" style={{ marginRight: 8 }} />}
        <Text style={styles.boutonTexte}>{texte}</Text>
      </LinearGradient>
    </PressableAnime>
  );
}

export function BoutonSecondaire({ texte, onPress }: { texte: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableAnime onPress={onPress} style={[styles.boutonSecondaire, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "600" }}>{texte}</Text>
    </PressableAnime>
  );
}

export function Skeleton({ width = "100%", height = 14, style }: { width?: DimensionValue; height?: number; style?: ViewStyle }) {
  const { colors } = useTheme();
  const opacite = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacite, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacite, { toValue: 0.45, duration: 650, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacite]);

  return <Animated.View style={[{ width, height, borderRadius: 8, backgroundColor: colors.border, opacity: opacite }, style]} />;
}

export function EnteteEcran({ titre, onRetour, action }: { titre: string; onRetour?: () => void; action?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.entete}>
      {onRetour && (
        <Pressable onPress={onRetour} hitSlop={10} style={[styles.retour, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Feather name="arrow-left" size={18} color={colors.textPrimary} />
        </Pressable>
      )}
      <Text style={{ fontSize: 16, fontWeight: "700", letterSpacing: -0.2, color: colors.textPrimary, flex: 1 }}>{titre}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: 16, padding: 16 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, alignSelf: "flex-start" },
  bouton: { paddingVertical: 15, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  boutonTexte: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 0.1 },
  boutonSecondaire: { paddingVertical: 13, borderRadius: 14, alignItems: "center", borderWidth: 1 },
  entete: { flexDirection: "row", alignItems: "center", marginBottom: 18, gap: 12 },
  retour: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
