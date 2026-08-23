import { View, Text, Pressable, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "@/lib/theme/ThemeProvider";

export function Carte({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
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
      <Text style={{ color: paires.fg, fontSize: 11 }}>{texte}</Text>
    </View>
  );
}

export function BoutonPrimaire({
  texte,
  onPress,
  disabled,
  couleur,
}: {
  texte: string;
  onPress: () => void;
  disabled?: boolean;
  couleur?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.bouton, { backgroundColor: couleur ?? colors.accent, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={styles.boutonTexte}>{texte}</Text>
    </Pressable>
  );
}

export function BoutonSecondaire({ texte, onPress }: { texte: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.boutonSecondaire, { borderColor: colors.border }]}>
      <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{texte}</Text>
    </Pressable>
  );
}

export function EnteteEcran({ titre, onRetour }: { titre: string; onRetour?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.entete}>
      {onRetour && (
        <Pressable onPress={onRetour} style={{ marginRight: 10 }}>
          <Text style={{ fontSize: 18, color: colors.textSecondary }}>←</Text>
        </Pressable>
      )}
      <Text style={{ fontSize: 16, fontWeight: "500", color: colors.textPrimary }}>{titre}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderWidth: 1, borderRadius: 12, padding: 16 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, alignSelf: "flex-start" },
  bouton: { paddingVertical: 13, borderRadius: 8, alignItems: "center" },
  boutonTexte: { color: "#fff", fontSize: 14, fontWeight: "500" },
  boutonSecondaire: { paddingVertical: 11, borderRadius: 8, alignItems: "center", borderWidth: 1 },
  entete: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
});
