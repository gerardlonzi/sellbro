import { useEffect, useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { t } from "@/lib/i18n";
import { sAbonnerPaywall, fermerPaywall, EtatPaywall } from "@/lib/trial/paywall";

// Modale paywall personnalisée (couleurs de l'app), affichée quand l'utilisateur
// tente une action restreinte après expiration de l'essai.
export function PaywallPopup() {
  const { colors } = useTheme();
  const [etat, setEtat] = useState<EtatPaywall>({ visible: false, langue: "fr", onUpgrade: () => {} });

  useEffect(() => sAbonnerPaywall(setEtat), []);

  function allerPro() {
    const cb = etat.onUpgrade;
    fermerPaywall();
    cb();
  }

  return (
    <Modal visible={etat.visible} transparent animationType="fade">
      <View style={styles.fond}>
        <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.borderPro }]}>
          <View style={[styles.icone, { backgroundColor: colors.proBg }]}>
            <Feather name="lock" size={24} color={colors.pro} />
          </View>
          <Text style={[styles.titre, { color: colors.textPrimary }]}>{t("essai_termine_titre", etat.langue)}</Text>
          <Text style={[styles.texte, { color: colors.textSecondary }]}>{t("paywall_message", etat.langue)}</Text>

          <View style={styles.ligneBoutons}>
            <Pressable onPress={fermerPaywall} style={[styles.boutonSecondaire, { borderColor: colors.border }]}>
              <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "500" }}>{t("rappel_essai_plus_tard", etat.langue)}</Text>
            </Pressable>
            <Pressable onPress={allerPro} style={[styles.boutonPro, { backgroundColor: colors.proFill }]}>
              <Text style={{ color: colors.onPro, fontSize: 14, fontWeight: "600" }}>{t("essai_termine_pro", etat.langue)}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 24 },
  carte: { width: "100%", maxWidth: 340, borderRadius: 16, padding: 24, alignItems: "center", borderWidth: 1 },
  icone: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  titre: { fontSize: 17, fontWeight: "600", marginBottom: 10, textAlign: "center" },
  texte: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  ligneBoutons: { flexDirection: "row", gap: 10, marginTop: 20, alignSelf: "stretch" },
  boutonSecondaire: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: "center", borderWidth: 1 },
  boutonPro: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: "center" },
});