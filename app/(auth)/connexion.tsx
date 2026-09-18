// app/(auth)/connexion.tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { useLangue, t } from "@/lib/i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { envoyerCodeEmail, verifierCodeEmail } from "@/lib/auth/emailVerification";
import { synchroniserPourUtilisateurCourant } from "@/lib/database/sync";
import { ActivityIndicator } from "react-native";

export default function Connexion() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { showToast } = useToast();
  const [etape, setEtape] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [chargement, setChargement] = useState(false);
  const [syncEnCours, setSyncEnCours] = useState(false);

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
    // Première connexion (ex. nouvel appareil) : on synchronise les données AVANT
    // d'entrer, avec un message visible. Sécurité : on n'attend jamais plus de
    // 20 s (réseau lent) — la sync continue en arrière-plan sinon.
    setSyncEnCours(true);
    try {
      await Promise.race([
        synchroniserPourUtilisateurCourant(),
        new Promise((resolve) => setTimeout(resolve, 20000)),
      ]);
    } catch {}
    router.replace("/(tabs)/accueil");
  }

  if (syncEnCours) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center" }]}>
        <Feather name="cloud" size={40} color={colors.accent} style={{ marginBottom: 16 }} />
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={{ color: colors.textPrimary, fontSize: 14, marginTop: 12, textAlign: "center" }}>
          {t("sync_en_cours", langue)}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.boutonRetour}>
        <Feather name="arrow-left" size={22} color={colors.textPrimary} />
      </Pressable>
      <View style={[styles.icone, { backgroundColor: colors.accentBg }]}>
        <Text style={{ fontSize: 28 }}>🏪</Text>
      </View>
      <Text style={[styles.titre, { color: colors.textPrimary }]}>{t("connexion_titre", langue)}</Text>
      <Text style={[styles.sousTitre, { color: colors.textSecondary }]}>{t("connexion_sous_titre", langue)}</Text>

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

          <Pressable onPress={() => setEtape("email")} style={{ marginTop: 16, alignItems: "center" }}>
            <Text style={{ color: colors.accent, fontSize: 13, textDecorationLine: "underline" }}>
              {t("otp_changer_email", langue)}
            </Text>
          </Pressable>
        </>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
  boutonRetour: { position: "absolute", top: 50, left: 24, zIndex: 1 },
  icone: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 14 },
  titre: { fontSize: 18, fontWeight: "500", marginBottom: 6, textAlign: "center" },
  sousTitre: { fontSize: 13, marginBottom: 24, textAlign: "center" },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 16 },
  bouton: { paddingVertical: 13, borderRadius: 8, alignItems: "center" },
  boutonTexte: { color: "#fff", fontSize: 14, fontWeight: "500" },
});