import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { EnteteEcran } from "@/components/UI";
import { traiterFileAttente } from "@/lib/sync/fileAttente";

export default function HorsLigne() {
  const { colors } = useTheme();
  const { langue } = useLangue();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16, paddingTop: 50 }}>
      <EnteteEcran titre={t("hors_ligne_titre", langue)} onRetour={() => router.back()} />

      <View style={[styles.bandeau, { backgroundColor: colors.warningBg }]}>
        <Feather name="wifi-off" size={18} color={colors.warning} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.warning, fontSize: 13, fontWeight: "600", marginBottom: 3 }}>
            {t("hors_ligne_bandeau_titre", langue)}
          </Text>
          <Text style={{ color: colors.warning, fontSize: 12, lineHeight: 18 }}>
            {t("hors_ligne_bandeau_texte", langue)}
          </Text>
        </View>
      </View>

      <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary, marginTop: 20, marginBottom: 4 }}>
        {t("hors_ligne_en_attente_titre", langue)}
      </Text>
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 16 }}>
        {t("hors_ligne_en_attente_texte", langue)}
      </Text>

      <Pressable style={[styles.bouton, { backgroundColor: colors.accent, marginTop: 8 }]} onPress={() => traiterFileAttente()}>
        <Feather name="refresh-cw" size={15} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{t("hors_ligne_bouton_reessayer", langue)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bandeau: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12 },
  bouton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 10 },
});