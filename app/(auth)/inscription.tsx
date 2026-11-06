import { useState } from "react";
import { View, Pressable } from "react-native";
import { Text } from "@/components/Texte";
import { EcranAuth, ChampAuth } from "@/components/EcranAuth";
import { BoutonPrimaire } from "@/components/UI";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase/client";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { useLangue, t } from "@/lib/i18n";
import { usePays } from "@/lib/pays/PaysProvider";
import { validerTelephone } from "@/lib/pays/validation";

// IMPORTANT : pas d'OTP envoyé ici. Le compte est créé immédiatement avec
// le numéro non vérifié. La vérification par SMS n'arrive que plus tard,
// au moment de l'abonnement Premium (voir décision prise avec Raphael).
export default function Inscription() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { showToast } = useToast();
  const { pays } = usePays();
  const [numero, setNumero] = useState("");
  const [chargement, setChargement] = useState(false);

  async function creerCompte() {
    if (chargement) return;
    const validation = validerTelephone(numero.trim(), pays, langue);
    if (!validation.valide) {
      showToast(validation.message ?? t("inscription_verifie_numero", langue), "error");
      return;
    }

    setChargement(true);
    const telephoneComplet = `${pays.indicatif}${numero.replace(/\s/g, "")}`;

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
    <EcranAuth
      titre={t("inscription_bienvenue", langue)}
      sousTitre={t("inscription_sous_titre", langue)}
      retour={false}
      pied={
        <Pressable onPress={() => router.push("/(auth)/connexion")} hitSlop={10}>
          <Text style={{ color: "#fff", fontSize: 13.5, fontWeight: "600" }}>{t("inscription_deja_compte", langue)}</Text>
        </Pressable>
      }
    >
      <Text style={{ color: colors.textSecondary, fontSize: 12.5, fontWeight: "600", marginBottom: 8 }}>{t("inscription_numero", langue)}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ paddingHorizontal: 12, justifyContent: "center", borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background, marginBottom: 14 }}>
          <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>{pays.drapeau} {pays.indicatif}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <ChampAuth icone="phone" valeur={numero} onChange={setNumero} placeholder="6XX XXX XXX" keyboardType="phone-pad" />
        </View>
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 11.5, marginBottom: 18, marginTop: -4 }}>{t("inscription_aide", langue)}</Text>
      <BoutonPrimaire texte={chargement ? t("inscription_creation", langue) : t("inscription_creer", langue)} icone="arrow-right" onPress={creerCompte} disabled={chargement} />
    </EcranAuth>
  );
}
