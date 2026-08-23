import { View, Text, Pressable, StyleSheet, Modal } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";

export function AccountPopup({ visible, onFermer }: { visible: boolean; onFermer: () => void }) {
  const { colors } = useTheme();
  const { langue } = useLangue();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.fond}>
        <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.icone, { backgroundColor: colors.proBg }]}>
            <Feather name="cloud" size={22} color={colors.pro} />
          </View>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "500", marginBottom: 8 }}>
            {t("popup_titre", langue)}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 22 }}>
            {t("popup_corps", langue)}
          </Text>
          <Pressable
            onPress={() => { onFermer(); router.push("/premium"); }}
            style={[styles.boutonPrincipal, { backgroundColor: colors.proFill }]}
          >
            <Text style={{ color: colors.onPro, fontSize: 14, fontWeight: "500" }}>
              {t("popup_creer_compte", langue)}
            </Text>
          </Pressable>
          <Pressable onPress={onFermer} style={{ paddingVertical: 11, alignItems: "center" }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("popup_plus_tard", langue)}</Text>
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