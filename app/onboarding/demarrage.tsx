import { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";

// Petit écran de transition entre le splash natif et la configuration
// de la boutique — donne un aperçu de la marque et de la promesse
// principale de l'app pendant un court instant, plutôt que d'atterrir
// brutalement sur un formulaire.
export default function Demarrage() {
  const { colors } = useTheme();
  const { langue } = useLangue();

  useEffect(() => {
    const minuteur = setTimeout(() => {
        router.replace("/onboarding/slides");
        }, 1600);
    return () => clearTimeout(minuteur);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.icone, { backgroundColor: colors.accentBg }]}>
        <Feather name="shopping-bag" size={36} color={colors.accent} />
      </View>
      <Text style={{ fontSize: 20, fontWeight: "700", color: colors.textPrimary, marginTop: 20 }}>
        {t("demarrage_titre", langue)}
      </Text>
      <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8, textAlign: "center", paddingHorizontal: 40 }}>
        {t("demarrage_message", langue)}
      </Text>
      <ActivityIndicator color={colors.accent} style={{ marginTop: 28 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  icone: { width: 84, height: 84, borderRadius: 24, alignItems: "center", justifyContent: "center" },
});