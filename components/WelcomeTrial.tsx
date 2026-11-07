import { useEffect, useState } from "react";
import { Text } from "@/components/Texte";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { ModalePremium } from "@/components/ModalePremium";
import { useLangue, t } from "@/lib/i18n";
import { useEssai } from "@/lib/trial/useEssai";
import { useAbonnement } from "@/lib/plan/useAbonnement";

const CLE_BIENVENUE = "bienvenue_essai_vue";
// Posé par l'écran de connexion : l'utilisateur revient (compte existant),
// le popup de bienvenue dit « Bon retour » au lieu de « Bienvenue ».
const CLE_RETOUR = "bienvenue_retour";
const CLE_RAPPELS_VUS = "essai_rappels_vus";
const CLE_EXPIRATION_VUE = "essai_expiration_vue";

// Seuils de rappel (en jours restants), répartis sur la durée totale.
function seuilsRappels(dureeTotale: number): number[] {
  const nb = Math.min(3, Math.max(1, Math.round(dureeTotale / 3)));
  const seuils: number[] = [];
  for (let i = nb; i >= 1; i--) {
    seuils.push(Math.ceil((dureeTotale * i) / (nb + 1)));
  }
  return seuils;
}

type EtatPopup =
  | { type: "aucun" }
  | { type: "bienvenue" }
  | { type: "rappel"; jours: number }
  | { type: "expiration" };

// Pop-ups d'essai : bienvenue (une fois), rappels (répartis sur la durée),
// expiration. Non intrusifs : un seul pop-up par ouverture, jamais quotidien.
export function WelcomeTrial() {
  const { langue } = useLangue();
  const essai = useEssai();
  const { expire: abonnementExpire } = useAbonnement();
  const [popup, setPopup] = useState<EtatPopup>({ type: "aucun" });
  const [estRetour, setEstRetour] = useState(false);

  useEffect(() => {
    // `verifie` et non `pret` : `pret` passe à true après la seule lecture
    // locale, qui ne trouve rien sur une installation neuve. La garde laissait
    // donc passer le pop-up d'essai vers un compte Pro qui venait de se
    // connecter — le temps que le plan soit lu, ou indéfiniment si aucun
    // rafraîchissement n'était redéclenché.
    if (essai.estPremium || !essai.pret || !essai.verifie) return;

    (async () => {
      const [bienvenue, rappelsVus, expirationVue, retour] = await Promise.all([
        AsyncStorage.getItem(CLE_BIENVENUE),
        AsyncStorage.getItem(CLE_RAPPELS_VUS),
        AsyncStorage.getItem(CLE_EXPIRATION_VUE),
        AsyncStorage.getItem(CLE_RETOUR),
      ]);
      setEstRetour(retour === "true");

      // En essai actif (TRIAL) : popup de bienvenue (une fois) puis rappels.
      if (essai.statut === "TRIAL") {
        if (bienvenue !== "true") {
          setPopup({ type: "bienvenue" });
          return;
        }
        // Sans durée connue (hors ligne, jamais synchronisé) : pas de rappel
        // plutôt qu'un calcul sur une valeur inventée.
        if (essai.dureeTotale != null) {
          const vus: number[] = rappelsVus ? JSON.parse(rappelsVus) : [];
          const prochain = seuilsRappels(essai.dureeTotale).find(
            (seuil) => essai.joursRestants <= seuil && !vus.includes(seuil)
          );
          if (prochain != null) setPopup({ type: "rappel", jours: essai.joursRestants });
        }
        return;
      }

      // En FREE (essai expiré) : popup d'expiration (une fois).
      if (essai.statut === "FREE") {
        if (expirationVue !== "true") setPopup({ type: "expiration" });
      }
    })();
  }, [essai.estPremium, essai.pret, essai.verifie, essai.statut, essai.joursRestants, essai.dureeTotale]);

  async function fermer() {
    if (popup.type === "bienvenue") await AsyncStorage.setItem(CLE_BIENVENUE, "true");
    if (popup.type === "expiration") await AsyncStorage.setItem(CLE_EXPIRATION_VUE, "true");
    if (popup.type === "rappel") {
      // Marque le seuil correspondant comme déjà affiché.
      const vus: number[] = JSON.parse((await AsyncStorage.getItem(CLE_RAPPELS_VUS)) ?? "[]");
      const seuil = essai.dureeTotale != null
        ? seuilsRappels(essai.dureeTotale).find((s) => essai.joursRestants <= s && !vus.includes(s))
        : undefined;
      if (seuil != null) {
        vus.push(seuil);
        await AsyncStorage.setItem(CLE_RAPPELS_VUS, JSON.stringify(vus));
      }
    }
    setPopup({ type: "aucun" });
  }

  function allerPro() {
    fermer();
    router.push("/premium");
  }

  if (popup.type === "aucun") return null;

  const estBienvenue = popup.type === "bienvenue";
  const estExpiration = popup.type === "expiration";

  const titre = estBienvenue
    ? t(estRetour ? "bienvenue_retour_titre" : "bienvenue_essai_titre", langue)
    : estExpiration
    ? abonnementExpire ? t("abonnement_termine_statut", langue) : t("essai_termine_titre", langue)
    : t("rappel_essai_titre", langue);

  const corps = estBienvenue
    ? t("bienvenue_essai_ligne1", langue)(essai.dureeTotale ?? essai.joursRestants)
    : estExpiration
    ? abonnementExpire ? t("paywall_message_abonnement", langue) : t("essai_termine_texte", langue)
    : t("rappel_essai_ligne1", langue)(popup.jours);

  // Prix inconnu (hors ligne sans cache) → on n'affiche pas la ligne de prix
  // plutôt qu'un montant faux ou NaN.
  const sousCorps = estBienvenue
    ? essai.prix != null ? t("bienvenue_essai_ligne2", langue)(essai.prix) : ""
    : estExpiration ? "" : t("rappel_essai_ligne2", langue);

  const avantages = estBienvenue
    ? [
        { icone: "camera" as const, texte: t("popup_avantage_scan", langue) },
        { icone: "mic" as const, texte: t("popup_avantage_vocal", langue) },
        { icone: "wifi-off" as const, texte: t("popup_avantage_hors_ligne", langue) },
      ]
    : undefined;

  return (
    <ModalePremium
      visible
      fond={estExpiration ? "paywall" : "welcome"}
      icone={estExpiration ? "lock" : estBienvenue ? "gift" : "clock"}
      teinte={estExpiration ? "danger" : "accent"}
      titre={titre}
      texte={corps}
      sousTexte={sousCorps || undefined}
      avantages={avantages}
      libellePrincipal={estExpiration ? t("essai_termine_pro", langue) : t("bienvenue_essai_pro", langue)}
      libelleSecondaire={estExpiration ? "OK" : estBienvenue ? t("bienvenue_essai_ok", langue) : t("rappel_essai_plus_tard", langue)}
      onPrincipal={allerPro}
      onSecondaire={fermer}
    />
  );
}
