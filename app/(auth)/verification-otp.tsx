import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { demarrerOuVerifierEssaiGratuit } from "@/lib/trial/deviceTrial";
import {
  envoyerCodeEmail,
  verifierCodeEmail,
  changerEmail,
  CLE_EMAIL_EN_ATTENTE,
} from "@/lib/auth/emailVerification";

export default function VerificationOtp() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const params = useLocalSearchParams<{ email: string }>();

  const [email, setEmail] = useState(params.email ?? "");
  const [code, setCode] = useState("");
  const [chargement, setChargement] = useState(false);
  const [modeModification, setModeModification] = useState(false);
  const [nouvelEmail, setNouvelEmail] = useState("");

  // Si l'email n'a pas été transmis par la route (redémarrage / deep link),
  // on le récupère depuis le stockage local pour pouvoir continuer la
  // vérification en cours.
  useEffect(() => {
    if (email) return;
    (async () => {
      const enAttente = await AsyncStorage.getItem(CLE_EMAIL_EN_ATTENTE);
      const sauvegarde = enAttente ?? (await AsyncStorage.getItem("boutika_email"));
      if (sauvegarde) setEmail(sauvegarde);
    })();
  }, [email]);

  function emailValide(valeur: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur);
  }

  async function confirmer() {
    setChargement(true);
    const { error } = await verifierCodeEmail(email, code);

    if (error) {
      setChargement(false);
      Alert.alert("", t("otp_erreur", langue));
      return;
    }

    await demarrerOuVerifierEssaiGratuit();
    await AsyncStorage.setItem("onboarding_termine", "true");
    await AsyncStorage.setItem("plan_actuel", "gratuit");

    setChargement(false);
    router.replace("/(tabs)/accueil");
  }

  async function renvoyer() {
    await envoyerCodeEmail(email);
    Alert.alert("", t("otp_sous_titre", langue)(email));
  }

  async function confirmerChangementEmail() {
    if (!emailValide(nouvelEmail)) {
      Alert.alert("", t("erreur_email_invalide", langue));
      return;
    }

    setChargement(true);
    const { error } = await changerEmail(email, nouvelEmail.trim());

    if (error) {
      setChargement(false);
      Alert.alert("", error.message);
      return;
    }

    setEmail(nouvelEmail.trim());
    setNouvelEmail("");
    setModeModification(false);
    setChargement(false);
    Alert.alert("", t("otp_email_modifie", langue));
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={{ fontSize: 18, fontWeight: "600", color: colors.textPrimary, marginBottom: 8, textAlign: "center" }}>
        {t("otp_titre", langue)}
      </Text>
      <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 24, textAlign: "center" }}>
        {t("otp_sous_titre", langue)(email)}
      </Text>

      {modeModification ? (
        <>
          <TextInput
            value={nouvelEmail}
            onChangeText={setNouvelEmail}
            placeholder={t("placeholder_email", langue)}
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoFocus
            style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, textAlign: "center" }]}
          />
          <Pressable
            onPress={confirmerChangementEmail}
            disabled={chargement}
            style={[styles.bouton, { backgroundColor: colors.accent, opacity: chargement ? 0.6 : 1 }]}
          >
            <Text style={styles.boutonTexte}>{t("otp_changer_email_confirmer", langue)}</Text>
          </Pressable>
          <Pressable onPress={() => setModeModification(false)} style={{ marginTop: 14, alignItems: "center" }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("otp_changer_email_annuler", langue)}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder={t("otp_placeholder", langue)}
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={10}
            style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, textAlign: "center", fontSize: 22, letterSpacing: 8 }]}
          />

          <Pressable onPress={confirmer} disabled={chargement} style={[styles.bouton, { backgroundColor: colors.accent, opacity: chargement ? 0.6 : 1 }]}>
            <Text style={styles.boutonTexte}>{chargement ? "..." : t("otp_confirmer", langue)}</Text>
          </Pressable>

          <Pressable onPress={renvoyer} style={{ marginTop: 16, alignItems: "center" }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("otp_renvoyer", langue)}</Text>
          </Pressable>

          <Pressable onPress={() => setModeModification(true)} style={{ marginTop: 20, alignItems: "center" }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, textDecorationLine: "underline" }}>
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
  input: { borderWidth: 1, borderRadius: 8, paddingVertical: 14, marginBottom: 20, paddingHorizontal: 2, fontSize: 15 },
  bouton: { paddingVertical: 14, borderRadius: 8, alignItems: "center" },
  boutonTexte: { color: "#fff", fontSize: 15, fontWeight: "500" },
});