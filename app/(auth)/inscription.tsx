import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase/client";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { useLangue, t } from "@/lib/i18n";

// IMPORTANT : pas d'OTP envoyé ici. Le compte est créé immédiatement avec
// le numéro non vérifié. La vérification par SMS n'arrive que plus tard,
// au moment de l'abonnement Premium (voir décision prise avec Raphael).
export default function Inscription() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { showToast } = useToast();
  const [numero, setNumero] = useState("");
  const [chargement, setChargement] = useState(false);

  async function creerCompte() {
    if (chargement) return;
    if (numero.trim().length < 9) {
      showToast(t("inscription_verifie_numero", langue), "error");
      return;
    }

    setChargement(true);
    const telephoneComplet = `+237${numero.replace(/\s/g, "")}`;

    // Connexion anonyme : crée une session sécurisée sans mot de passe.
    // Le trigger SQL crée automatiquement la ligne profiles associée.
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();

    if (authError || !authData.user) {
      setChargement(false);
      showToast(t("inscription_echec", langue), "error");
      return;
    }

    // On met à jour la ligne profiles créée par le trigger, avec le vrai numéro.
    const { error } = await supabase
      .from("profiles")
      .update({ telephone: telephoneComplet })
      .eq("id", authData.user.id);

    setChargement(false);

    if (error) {
      showToast(t("inscription_echec", langue), "error");
      return;
    }
  
    router.replace("/(auth)/config-boutique");
  }
    return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.icone, { backgroundColor: colors.accentBg }]}>
        <Text style={{ fontSize: 26 }}>🏪</Text>
      </View>
      <Text style={[styles.titre, { color: colors.textPrimary }]}>{t("inscription_bienvenue", langue)}</Text>
      <Text style={[styles.sousTitre, { color: colors.textSecondary }]}>
        {t("inscription_sous_titre", langue)}
      </Text>

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {t("inscription_numero", langue)}
      </Text>
      <View style={styles.ligneNumero}>
        <View style={[styles.indicatif, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.textPrimary }}>🇨🇲 +237</Text>
        </View>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
          placeholder="6XX XXX XXX"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          value={numero}
          onChangeText={setNumero}
        />
      </View>
      <Text style={[styles.aide, { color: colors.textMuted }]}>
        {t("inscription_aide", langue)}
      </Text>

      <Pressable
        style={[styles.bouton, { backgroundColor: colors.accent, opacity: chargement ? 0.6 : 1 }]}
        onPress={creerCompte}
        disabled={chargement}
      >
        <Text style={styles.boutonTexte}>
          {chargement ? t("inscription_creation", langue) : t("inscription_creer", langue)}
        </Text>
      </Pressable>
      <Pressable onPress={() => router.push("/(auth)/connexion")} style={{ marginTop: 16 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: "center" }}>
        {t("inscription_deja_compte", langue)}
      </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
  icone: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 14 },
  titre: { fontSize: 20, fontWeight: "500", textAlign: "center", marginBottom: 6 },
  sousTitre: { fontSize: 14, textAlign: "center", marginBottom: 28 },
  label: { fontSize: 12, marginBottom: 6 },
  ligneNumero: { flexDirection: "row", gap: 8, marginBottom: 8 },
  indicatif: { paddingHorizontal: 10, justifyContent: "center", borderRadius: 8, borderWidth: 1 },
  input: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  aide: { fontSize: 11, marginBottom: 24 },
  bouton: { paddingVertical: 14, borderRadius: 8, alignItems: "center" },
  boutonTexte: { color: "#fff", fontSize: 15, fontWeight: "500" },
});
