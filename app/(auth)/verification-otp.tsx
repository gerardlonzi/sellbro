import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase/client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { demarrerOuVerifierEssaiGratuit } from "@/lib/trial/deviceTrial";

export default function VerificationOtp() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState("");
  const [chargement, setChargement] = useState(false);

  async function confirmer() {
    setChargement(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  
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
    await supabase.auth.signInWithOtp({ email });
    Alert.alert("", t("otp_sous_titre", langue)(email));
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={{ fontSize: 18, fontWeight: "600", color: colors.textPrimary, marginBottom: 8, textAlign: "center" }}>
        {t("otp_titre", langue)}
      </Text>
      <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 24, textAlign: "center" }}>
        {t("otp_sous_titre", langue)(email)}
      </Text>

      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder={t("otp_placeholder", langue)}
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        maxLength={6}
        style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, textAlign: "center", fontSize: 22, letterSpacing: 8 }]}
      />

      <Pressable onPress={confirmer} disabled={chargement} style={[styles.bouton, { backgroundColor: colors.accent, opacity: chargement ? 0.6 : 1 }]}>
        <Text style={styles.boutonTexte}>{chargement ? "..." : t("otp_confirmer", langue)}</Text>
      </Pressable>

      <Pressable onPress={renvoyer} style={{ marginTop: 16, alignItems: "center" }}>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("otp_renvoyer", langue)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
  input: { borderWidth: 1, borderRadius: 8, paddingVertical: 14, marginBottom: 20 },
  bouton: { paddingVertical: 14, borderRadius: 8, alignItems: "center" },
  boutonTexte: { color: "#fff", fontSize: 15, fontWeight: "500" },
});