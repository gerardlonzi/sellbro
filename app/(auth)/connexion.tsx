// app/(auth)/connexion.tsx
import { useState } from "react";
import { View, Pressable } from "react-native";
import { Text } from "@/components/Texte";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { useLangue, t } from "@/lib/i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { envoyerCodeEmail, verifierCodeEmail } from "@/lib/auth/emailVerification";
import { demarrerOuVerifierEssaiGratuit } from "@/lib/trial/deviceTrial";
import { rafraichirPlan } from "@/lib/plan/planStore";
import { synchroniserPourUtilisateurCourant } from "@/lib/database/sync";
import { ActivityIndicator } from "react-native";
import { EcranAuth, ChampAuth, ChampCode } from "@/components/EcranAuth";
import { BoutonPrimaire } from "@/components/UI";

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

    // L'email sert d'affichage hors ligne (Paramètres → Compte) : on le cache
    // dès la connexion, sans attendre la première visite des réglages.
    await AsyncStorage.setItem("boutika_user_email", email.trim());
    await AsyncStorage.setItem("onboarding_termine", "true");
    // Connexion (compte existant) ≠ inscription : le popup d'essai affichera
    // « Bon retour » au lieu de « Bienvenue ».
    await AsyncStorage.setItem("bienvenue_retour", "true");
    // Première connexion (ex. nouvel appareil) : on synchronise les données AVANT
    // d'entrer, avec un message visible. Sécurité : on n'attend jamais plus de
    // 20 s (réseau lent) — la sync continue en arrière-plan sinon.
    setSyncEnCours(true);
    try {
      // Plan d'abord : il décide si les données locales peuvent être poussées
      // et évite d'afficher « essai terminé » à un abonné.
      await rafraichirPlan().catch(() => {});
      // Essai du compte (créé côté serveur si c'est un compte neuf) : écrit le
      // cache local de CE compte avant d'entrer dans l'app.
      await demarrerOuVerifierEssaiGratuit().catch(() => {});
      await Promise.race([
        synchroniserPourUtilisateurCourant(),
        new Promise((resolve) => setTimeout(resolve, 20000)),
      ]);
    } catch {}
    router.replace("/(tabs)/accueil");
  }

  if (syncEnCours) {
    return (
      <EcranAuth titre={t("sync_en_cours", langue)} retour={false}>
        <View style={{ alignItems: "center", paddingVertical: 18 }}>
          <Feather name="cloud" size={40} color={colors.accent} style={{ marginBottom: 14 }} />
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      </EcranAuth>
    );
  }

  return (
    <EcranAuth titre={t("connexion_titre", langue)} sousTitre={t("connexion_sous_titre", langue)}>
      {etape === "email" ? (
        <>
          <ChampAuth
            icone="mail"
            valeur={email}
            onChange={setEmail}
            placeholder={t("placeholder_email", langue)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <BoutonPrimaire texte={chargement ? "…" : t("connexion_recevoir_code", langue)} icone="arrow-right" onPress={envoyerCode} disabled={chargement} />
        </>
      ) : (
        <>
          <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center", marginBottom: 14 }}>{t("connexion_code_recu", langue)}</Text>
          <ChampCode valeur={code} onChange={setCode} />
          <BoutonPrimaire texte={chargement ? "…" : t("otp_confirmer", langue)} icone="check" onPress={verifierCode} disabled={chargement || code.length < 6} />
          <Pressable onPress={() => setEtape("email")} style={{ marginTop: 16, alignItems: "center" }}>
            <Text style={{ color: colors.accent, fontSize: 13.5, fontWeight: "600" }}>{t("otp_changer_email", langue)}</Text>
          </Pressable>
        </>
      )}
    </EcranAuth>
  );
}
