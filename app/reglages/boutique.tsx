import { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { EnteteEcran, BoutonPrimaire } from "@/components/UI";

export default function InfosBoutique() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");

  useEffect(() => {
    AsyncStorage.getItem("boutika_nom_boutique").then((v) => v && setNom(v));
    AsyncStorage.getItem("boutika_telephone").then((v) => v && setTelephone(v));
  }, []);

  async function sauvegarder() {
    await AsyncStorage.setItem("boutika_nom_boutique", nom);
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <EnteteEcran titre={t("boutique_reglage_titre", langue)} onRetour={() => router.back()} />

      <Text style={[styles.label, { color: colors.textSecondary }]}>{t("boutique_nom_label", langue)}</Text>
      <TextInput value={nom} onChangeText={setNom} style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]} />

      <Text style={[styles.label, { color: colors.textSecondary }]}>{t("boutique_telephone_label", langue)}</Text>
      <View style={[styles.input, { borderColor: colors.border, justifyContent: "center" }]}>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>{telephone || "—"}</Text>
      </View>

      <View style={{ marginTop: 20 }}>
        <BoutonPrimaire texte={t("produit_sauver", langue)} onPress={sauvegarder} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
});