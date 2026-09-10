// app/(auth)/connexion.tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { useLangue, t } from "@/lib/i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { envoyerCodeEmail, verifierCodeEmail } from "@/lib/auth/emailVerification";

export default function Connexion() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { showToast } = useToast();
  const [etape, setEtape] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [chargement, setChargement] = useState(false);

  function emailValide(valeur: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur);
  }

  async function envoyerCode() {
    if (!emailValide(email)) {
      showToast(t("erreur_email_invalide", langue), "error");
      return;
    }
    setChargement(true);
    const { error } = await envoyerCodeEmail(email.trim());
    setChargement(false);

    if (error) {
      showToast(t("erreur_connexion_requise", langue), "error");
      return;
    }
    setEtape("code");
  }

  async function verifierCode() {
    setChargement(true);
    const { error } = await verifierCodeEmail(email.trim(), code);
    setChargement(false);

    if (error) {
      showToast(t("otp_erreur", langue), "error");
      return;
    }

    await AsyncStorage.setItem("onboarding_termine", "true");
    router.replace("/(tabs)/accueil");
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.titre, { color: colors.textPrimary }]}>{t("connexion_titre", langue)}</Text>

      {etape === "email" ? (
        <>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>{t("label_email", langue)}</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
            placeholder={t("placeholder_email", langue)}
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <Pressable
            onPress={envoyerCode}
            disabled={chargement}
            style={[styles.bouton, { backgroundColor: colors.accent, opacity: chargement ? 0.6 : 1 }]}
          >
            <Text style={styles.boutonTexte}>{chargement ? "..." : t("connexion_recevoir_code", langue)}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>{t("connexion_code_recu", langue)}</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, textAlign: "center", fontSize: 20, letterSpacing: 8 }]}
            placeholder="123456"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
          />
          <Pressable
            onPress={verifierCode}
            disabled={chargement}
            style={[styles.bouton, { backgroundColor: colors.accent, opacity: chargement ? 0.6 : 1 }]}
          >
            <Text style={styles.boutonTexte}>{chargement ? "..." : t("otp_confirmer", langue)}</Text>
          </Pressable>
        </>
      )}

      <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: "center" }}>
          {t("connexion_pas_de_compte", langue)}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
  titre: { fontSize: 18, fontWeight: "500", marginBottom: 24, textAlign: "center" },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 16 },
  bouton: { paddingVertical: 13, borderRadius: 8, alignItems: "center" },
  boutonTexte: { color: "#fff", fontSize: 14, fontWeight: "500" },
});