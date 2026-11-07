import { useEffect, useState } from "react";
import { Pressable } from "react-native";
import { Text } from "@/components/Texte";
import { EcranAuth, ChampAuth, ChampCode } from "@/components/EcranAuth";
import { BoutonPrimaire } from "@/components/UI";
import { router, useLocalSearchParams } from "expo-router";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useToast } from "@/lib/toast/ToastProvider";
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
  const { showToast } = useToast();
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
      showToast(t("otp_erreur", langue), "error");
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
    showToast(t("otp_sous_titre", langue)(email), "info");
  }

  async function confirmerChangementEmail() {
    if (!emailValide(nouvelEmail)) {
      showToast(t("erreur_email_invalide", langue), "error");
      return;
    }

    setChargement(true);
    const { error } = await changerEmail(email, nouvelEmail.trim());

    if (error) {
      setChargement(false);
      showToast(error.message, "error");
      return;
    }

    setEmail(nouvelEmail.trim());
    setNouvelEmail("");
    setModeModification(false);
    setChargement(false);
    showToast(t("otp_email_modifie", langue), "success");
  }

  const [secondes, setSecondes] = useState(30);
  useEffect(() => {
    if (secondes <= 0) return;
    const id = setTimeout(() => setSecondes((x) => x - 1), 1000);
    return () => clearTimeout(id);
  }, [secondes]);

  return (
    <EcranAuth titre={t("otp_titre", langue)} sousTitre={t("otp_sous_titre", langue)(email)}>
      {modeModification ? (
        <>
          <ChampAuth
            icone="mail"
            valeur={nouvelEmail}
            onChange={setNouvelEmail}
            placeholder={t("placeholder_email", langue)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoFocus
          />
          <BoutonPrimaire texte={chargement ? "…" : t("otp_changer_email_confirmer", langue)} icone="check" onPress={confirmerChangementEmail} disabled={chargement} />
          <Pressable onPress={() => setModeModification(false)} style={{ marginTop: 14, alignItems: "center" }}>
            <Text style={{ color: colors.textMuted, fontSize: 13.5 }}>{t("otp_changer_email_annuler", langue)}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ChampCode valeur={code} onChange={setCode} />
          <BoutonPrimaire texte={chargement ? "…" : t("otp_confirmer", langue)} icone="check" onPress={confirmer} disabled={chargement || code.length < 6} />
          <Pressable
            onPress={() => { if (secondes > 0) return; setSecondes(30); renvoyer(); }}
            style={{ marginTop: 16, alignItems: "center", opacity: secondes > 0 ? 0.55 : 1 }}
          >
            <Text style={{ color: colors.accent, fontSize: 13.5, fontWeight: "600" }}>
              {t("otp_renvoyer", langue)}{secondes > 0 ? `  ·  ${secondes}s` : ""}
            </Text>
          </Pressable>
          <Pressable onPress={() => setModeModification(true)} style={{ marginTop: 14, alignItems: "center" }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, textDecorationLine: "underline" }}>{t("otp_changer_email", langue)}</Text>
          </Pressable>
        </>
      )}
    </EcranAuth>
  );
}
