import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";

const CLES_ETAPES = [
  { icone: "mic" as const, cle: "tour_etape_vocal" as const },
  { icone: "camera" as const, cle: "tour_etape_scan" as const },
  { icone: "edit-3" as const, cle: "tour_etape_manuel" as const },
  { icone: "credit-card" as const, cle: "tour_etape_creances" as const },
];

export function TourGuide({ visible, onTerminer }: { visible: boolean; onTerminer: () => void }) {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const [etape, setEtape] = useState(0);

  const donnee = CLES_ETAPES[etape];
  const dernierePas = etape === CLES_ETAPES.length - 1;

  function suivant() {
    if (dernierePas) onTerminer();
    else setEtape(etape + 1);
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.fond}>
        <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.enTete}>
            <View style={[styles.pastille, { backgroundColor: colors.proFill }]}>
              <Text style={{ color: colors.onPro, fontSize: 11, fontWeight: "500" }}>{etape + 1}</Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>
              {t("tour_sur", langue)} {CLES_ETAPES.length}
            </Text>
          </View>

          <View style={[styles.icone, { backgroundColor: colors.proBg }]}>
            <Feather name={donnee.icone} size={22} color={colors.pro} />
          </View>

          <Text style={{ color: colors.textPrimary, fontSize: 14, lineHeight: 21, marginBottom: 20 }}>
            {t(donnee.cle, langue)}
          </Text>

          <View style={styles.bas}>
            <Pressable onPress={onTerminer}>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t("tour_passer", langue)}</Text>
            </Pressable>
            <Pressable onPress={suivant} style={[styles.boutonSuivant, { backgroundColor: colors.proFill }]}>
              <Text style={{ color: colors.onPro, fontSize: 12, fontWeight: "500" }}>
                {dernierePas ? t("tour_terminer", langue) : t("tour_suivant", langue)}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  carte: { borderWidth: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 22 },
  enTete: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  pastille: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  icone: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  bas: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  boutonSuivant: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
});