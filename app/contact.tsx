import { View, Text, Pressable, ScrollView, StyleSheet, Linking } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { EnteteEcran } from "@/components/UI";

const NUMERO_SUPPORT = "+237600000000";

export default function Contact() {
  const { colors } = useTheme();
  const { langue } = useLangue();

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <EnteteEcran titre={t("contact_titre", langue)} onRetour={() => router.back()} />
      <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 18 }}>{t("contact_sous_titre", langue)}</Text>

      <Pressable onPress={() => Linking.openURL(`https://wa.me/${NUMERO_SUPPORT.replace("+", "")}`)} style={[styles.boutonContact, { backgroundColor: "#1D9E75" }]}>
        <Feather name="message-circle" size={18} color="#fff" />
        <View>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "500" }}>{t("contact_whatsapp", langue)}</Text>
          <Text style={{ color: "#fff", fontSize: 11, opacity: 0.9 }}>{t("contact_whatsapp_desc", langue)}</Text>
        </View>
      </Pressable>

      <Pressable onPress={() => Linking.openURL(`tel:${NUMERO_SUPPORT}`)} style={[styles.boutonContact, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
        <Feather name="phone" size={18} color={colors.textPrimary} />
        <View>
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "500" }}>{t("contact_appel", langue)}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{t("contact_appel_desc", langue)}</Text>
        </View>
      </Pressable>

      <Pressable onPress={() => Linking.openURL("mailto:support@boutika.app")} style={[styles.boutonContact, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
        <Feather name="mail" size={18} color={colors.textPrimary} />
        <View>
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "500" }}>{t("contact_email", langue)}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{t("contact_email_desc", langue)}</Text>
        </View>
      </Pressable>

      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 16, marginBottom: 10, textTransform: "uppercase" }}>
        {t("contact_faq_titre", langue)}
      </Text>
      <View style={[styles.carteFaq, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {[t("contact_faq_code", langue), t("contact_faq_paiement", langue), t("contact_faq_numero", langue)].map((question, i, arr) => (
          <View key={question} style={[styles.ligneFaq, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <Text style={{ fontSize: 13, color: colors.textPrimary }}>{question}</Text>
            <Feather name="chevron-right" size={14} color={colors.textMuted} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, paddingTop: 50 },
  boutonContact: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, marginBottom: 10 },
  carteFaq: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  ligneFaq: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 },
});