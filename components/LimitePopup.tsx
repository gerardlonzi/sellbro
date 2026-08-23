import { View, Text, Pressable, StyleSheet, Modal } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";

type TypeLimite = "fonctionnalite" | "quota_vocal" | "quota_scan";

export function LimitePopup({
  visible,
  type,
  onFermer,
}: {
  visible: boolean;
  type: TypeLimite;
  onFermer: () => void;
}) {
  const { colors } = useTheme();
  const { langue } = useLangue();

  function texteCorps() {
    if (type === "quota_vocal") return t("limite_texte_quota_vocal", langue);
    if (type === "quota_scan") return t("limite_texte_quota_scan", langue);
    return t("limite_texte_fonctionnalite", langue);
  }

  const titre = type === "fonctionnalite" ? t("limite_titre_fonctionnalite", langue) : t("limite_titre_quota", langue);

  function allerVersLesForfaits() {
    onFermer();
    router.push("/premium");
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.fond}>
        <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.icone, { backgroundColor: colors.proBg }]}>
            <Feather name={type === "fonctionnalite" ? "star" : "trending-up"} size={22} color={colors.pro} />
          </View>
          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.textPrimary, marginBottom: 8 }}>{titre}</Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: 22 }}>{texteCorps()}</Text>
          <Pressable onPress={allerVersLesForfaits} style={[styles.boutonPrincipal, { backgroundColor: colors.proFill }]}>
            <Text style={{ color: colors.onPro, fontSize: 14, fontWeight: "600" }}>{t("limite_bouton_forfaits", langue)}</Text>
          </Pressable>
          <Pressable onPress={onFermer} style={{ paddingVertical: 11, alignItems: "center" }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("limite_bouton_fermer", langue)}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  carte: { width: "100%", borderWidth: 1, borderRadius: 16, padding: 22 },
  icone: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  boutonPrincipal: { paddingVertical: 13, borderRadius: 10, alignItems: "center", marginBottom: 4 },
});