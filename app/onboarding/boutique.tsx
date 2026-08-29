import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Modal, Alert } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t, Langue } from "@/lib/i18n";
import { useCurrency, DEVISES } from "@/lib/currency/CurrencyProvider";
import { useConnexion } from "@/lib/useConnexion";
import { supabase } from "@/lib/supabase/client";
import { usePays } from "@/lib/pays/PaysProvider";
import { verifierLimiteAppareil, enregistrerInscriptionAppareil } from "@/lib/auth/limiteAppareil";

export default function OnboardingBoutique() {
  const { colors } = useTheme();
  const { langue, changerLangue } = useLangue();
  const { devise, setDevise } = useCurrency();
  const [nomBoutique, setNomBoutique] = useState("");
  const enLigne = useConnexion();
  const [verificationEnCours, setVerificationEnCours] = useState(false);
  const { pays } = usePays();
const [telephone, setTelephone] = useState("");

  const [email, setEmail] = useState("");

  function emailValide(valeur: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur);
  }
  
  async function continuer() {

    if (!enLigne) {
      Alert.alert("", t("erreur_connexion_requise", langue));
      return;
    }
    if (!emailValide(email)) {
      Alert.alert("", t("erreur_email_invalide", langue));
      return;
    }
  
    setVerificationEnCours(true);
  
    const autorise = await verifierLimiteAppareil();
    if (!autorise) {
      setVerificationEnCours(false);
      Alert.alert("", t("erreur_trop_de_comptes", langue));
      return;
    }
  
    await AsyncStorage.setItem("boutika_email", email);
    await AsyncStorage.setItem("boutika_nom_boutique", nomBoutique);
    await AsyncStorage.setItem("boutika_langue", langue);
await AsyncStorage.setItem("boutika_devise", devise.code);

    if (telephone.trim()) {
      await AsyncStorage.setItem("boutika_telephone", `${pays.indicatif}${telephone.replace(/\s/g, "")}`);
    }  
    const { error } = await supabase.auth.signInWithOtp({ email });
    setVerificationEnCours(false);
  
    if (error) {
      Alert.alert("", "Impossible d'envoyer le code, réessaie.");
      return;
    }
  
    await enregistrerInscriptionAppareil();
    router.push({ pathname: "/(auth)/verification-otp", params: { email } });
  }






  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={{ fontSize: 20, fontWeight: "500", color: colors.textPrimary, marginBottom: 24 }}>
        {t("onboarding_titre_boutique", langue)}
      </Text>

      <Text style={[styles.label, { color: colors.textSecondary, fontWeight: "500", fontSize: 14 }]}>
        {t("label_nom_boutique", langue)}
      </Text>
      <TextInput
        value={nomBoutique}
        onChangeText={setNomBoutique}
        placeholder={t("placeholder_nom_boutique", langue)}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
      />

      <Text style={[styles.label, { color: colors.textSecondary, fontWeight: "500", fontSize: 14 }]}>
  {t("label_email", langue)}
</Text>
<TextInput
  value={email}
  onChangeText={setEmail}
  placeholder={t("placeholder_email", langue)}
  placeholderTextColor={colors.textMuted}
  keyboardType="email-address"
  autoCapitalize="none"
  style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
/>
<Text style={[styles.label, { color: colors.textSecondary, fontWeight: "500", fontSize: 14 }]}>
  {t("label_telephone_boutique", langue)}
</Text>
<View style={styles.ligneNumero}>
  <Pressable onPress={() => router.push("/pays")} style={[styles.indicatif, { borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 4 }]}>
    <Text style={{ fontSize: 14 }}>{pays.drapeau} {pays.indicatif}</Text>
    <Feather name="chevron-down" size={12} color={colors.textMuted} />
  </Pressable>
  <TextInput
    value={telephone}
    onChangeText={setTelephone}
    placeholder={t("placeholder_telephone", langue)}
    placeholderTextColor={colors.textMuted}
    keyboardType="phone-pad"
    style={[styles.inputNumero, { borderColor: colors.border, color: colors.textPrimary }]}
  />
</View>

      <Text style={[styles.label, { color: colors.textSecondary, fontWeight: "500", fontSize: 14 }]}>
        {t("label_langue", langue)}
      </Text>
      <View style={styles.ligneChoix}>
        {(["fr", "en"] as Langue[]).map((l) => (
          <Pressable
            key={l}
            onPress={() => changerLangue(l)}
            style={[styles.choix, { borderColor: langue === l ? colors.accent : colors.border, borderWidth: langue === l ? 2 : 1 }]}
          >
            <Text style={{ color: langue === l ? colors.accent : colors.textPrimary, fontSize: 13 }}>
              {l === "fr" ? "Français" : "English"}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, { color: colors.textSecondary, fontWeight: "500", fontSize: 14 }]}>
        {t("label_devise", langue)}
      </Text>
      <Pressable onPress={() => router.push("/devise")} style={[styles.selecteurDevise, { borderColor: colors.border }]}>
        <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{devise.nom}</Text>
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </Pressable>

      <Pressable
  onPress={continuer}
  disabled={verificationEnCours}
  style={[styles.bouton, { backgroundColor: colors.accent, marginTop: 30, opacity: verificationEnCours ? 0.6 : 1 }]}
>
  <Text style={styles.boutonTexte}>
    {verificationEnCours ? t("verification_numero_encours", langue) : t("continuer", langue)}
  </Text>
</Pressable>
<Pressable onPress={() => router.push("/accueil")} style={{ padding: 20, paddingTop: 50, zIndex: 2 }}>
        <Feather name="arrow-left" size={22} color={colors.textSecondary} />
    </Pressable>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60 },
  label: { fontSize: 12, marginBottom: 8, marginTop: 18 },
  ligneNumero: { flexDirection: "row", gap: 8 },
indicatif: { justifyContent: "center", paddingHorizontal: 10, borderWidth: 1, borderRadius: 8 },
inputNumero: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  ligneChoix: { flexDirection: "row", gap: 8 },
  choix: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  bouton: { paddingVertical: 14, borderRadius: 8, alignItems: "center" },
  boutonTexte: { color: "#fff", fontSize: 15, fontWeight: "500" },
  selecteurDevise: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 },
  fondModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  carteModal: { width: "100%", borderWidth: 1, borderRadius: 16, padding: 22 },
  iconeModal: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  boutonModalPrincipal: { paddingVertical: 13, borderRadius: 10, alignItems: "center", marginBottom: 4 },
});