import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t, Langue } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { usePays } from "@/lib/pays/PaysProvider";
import { EnteteEcran } from "@/components/UI";

export default function ReglagesLangueDevise() {
  const { colors } = useTheme();
  const { langue, changerLangue } = useLangue();
  const { devise } = useCurrency();
  const { pays } = usePays();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <EnteteEcran titre={t("langue_devise_titre", langue)} onRetour={() => router.back()} />

      <Text style={[styles.label, { color: colors.textMuted }]}>{t("langue_devise_langue_label", langue)}</Text>
      <View style={styles.ligneChoix}>
        {(["fr", "en"] as Langue[]).map((l) => (
          <Pressable key={l} onPress={() => changerLangue(l)} style={[styles.choix, { borderColor: langue === l ? colors.accent : colors.border, borderWidth: langue === l ? 2 : 1 }]}>
            <Text style={{ color: langue === l ? colors.accent : colors.textPrimary, fontSize: 13 }}>{l === "fr" ? "Français" : "English"}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, { color: colors.textMuted, marginTop: 20 }]}>{t("langue_devise_devise_label", langue)}</Text>
      <Pressable onPress={() => router.push("/devise")} style={[styles.selecteur, { borderColor: colors.border }]}>
        <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{devise.nom}</Text>
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </Pressable>

      <Text style={[styles.label, { color: colors.textMuted, marginTop: 16 }]}>{t("langue_devise_pays_label", langue)}</Text>
      <Pressable onPress={() => router.push("/pays")} style={[styles.selecteur, { borderColor: colors.border }]}>
        <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{pays.drapeau} {pays.nom}</Text>
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, marginBottom: 8, textTransform: "uppercase" },
  ligneChoix: { flexDirection: "row", gap: 8 },
  choix: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  selecteur: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 },
});