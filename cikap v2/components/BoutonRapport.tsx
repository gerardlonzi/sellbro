import { Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";

// Bouton d'en-tête « Télécharger le rapport », réutilisable sur toutes les
// pages qui en exposent un. `enCours` remplace l'icône par un spinner pendant
// la génération du PDF.
export function BoutonRapport({ onPress, enCours }: { onPress: () => void; enCours?: boolean }) {
  const { colors } = useTheme();
  const { langue } = useLangue();

  return (
    <Pressable
      onPress={onPress}
      disabled={enCours}
      accessibilityLabel={t("rapport_telecharger", langue)}
      accessibilityRole="button"
      style={[styles.bouton, { borderColor: colors.border }]}
    >
      {enCours ? (
        <ActivityIndicator size="small" color={colors.textSecondary} />
      ) : (
        <Feather name="download" size={14} color={colors.textSecondary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bouton: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
