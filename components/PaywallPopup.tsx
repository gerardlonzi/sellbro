import { useEffect, useState } from "react";
import { ModalePremium, OffrePopup } from "@/components/ModalePremium";
import { sAbonnerPaywall, fermerPaywall, EtatPaywall } from "@/lib/trial/paywall";
import { useAbonnement } from "@/lib/plan/useAbonnement";
import { usePlanActuel } from "@/lib/plan/usePlanActuel";
import { useEssai } from "@/lib/trial/useEssai";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { chargerPlans } from "@/lib/plan/quotas";
import { useLangue, t } from "@/lib/i18n";

// Modale paywall unique, deux usages :
//  • essai / abonnement terminé  → on montre Starter ET Premium avec leurs prix
//    (lus depuis la table `plans`, jamais en dur) ;
//  • fonction IA (scan / vocal)   → « réservé à Premium », y compris pour un
//    abonné Starter, avec le prix Premium.
export function PaywallPopup() {
  const { expire: abonnementExpire } = useAbonnement();
  const essai = useEssai();
  const { planId } = usePlanActuel();
  const { langue } = useLangue();
  const { formater } = useCurrency();
  const [etat, setEtat] = useState<EtatPaywall>({ visible: false, langue: "fr", onUpgrade: () => {} });
  const [prix, setPrix] = useState<{ starter: number | null; premium: number | null }>({ starter: null, premium: null });

  useEffect(() => sAbonnerPaywall(setEtat), []);
  useEffect(() => {
    chargerPlans()
      .then((p) => setPrix({ starter: p.starter?.prix ?? null, premium: p.premium?.prix ?? null }))
      .catch(() => {});
  }, []);

  function allerPlans() {
    const cb = etat.onUpgrade;
    fermerPaywall();
    cb();
  }

  const estIA = etat.raison === "ia";
  const estStarter = planId === "starter";
  const estPremium = planId === "premium";

  // Un Premium n'a jamais de paywall. Un Starter n'en voit que pour l'IA.
  // (Un abonné payant ne doit jamais lire « essai gratuit terminé ».)
  if (estPremium) return null;
  if (!estIA && essai.estPremium) return null;

  const suffixe = t("par_mois", langue);
  const offreStarter: OffrePopup | null = prix.starter != null
    ? { id: "starter", nom: "Starter", prix: formater(prix.starter), suffixe }
    : null;
  const offrePremium: OffrePopup | null = prix.premium != null
    ? { id: "premium", nom: "Premium", prix: formater(prix.premium), suffixe, surligne: true, badge: t("offre_recommande", langue) }
    : null;

  let titre: string;
  let message: string;
  let bouton: string;
  let offres: OffrePopup[];
  let avantages: { icone: any; texte: string }[];

  if (estIA) {
    titre = t("paywall_ia_titre", langue);
    message = estStarter ? t("paywall_ia_texte_starter", langue) : t("paywall_ia_texte_gratuit", langue);
    bouton = t("paywall_ia_bouton", langue);
    offres = offrePremium ? [offrePremium] : [];
    avantages = [
      { icone: "camera", texte: t("popup_avantage_scan", langue) },
      { icone: "mic", texte: t("popup_avantage_vocal", langue) },
    ];
  } else {
    titre = abonnementExpire ? t("abonnement_termine_statut", langue) : t("essai_termine_titre", langue);
    message = t("paywall_choisir_offre", langue);
    bouton = t("paywall_voir_offres", langue);
    offres = [offreStarter, offrePremium].filter(Boolean) as OffrePopup[];
    avantages = [
      { icone: "shield", texte: t("paywall_donnees_gardees", langue) },
      { icone: "camera", texte: t("popup_avantage_scan", langue) },
      { icone: "mic", texte: t("popup_avantage_vocal", langue) },
    ];
  }

  return (
    <ModalePremium
      visible={etat.visible}
      fond="paywall"
      icone={estIA ? "zap" : "lock"}
      teinte="pro"
      titre={titre}
      texte={message}
      offres={offres}
      avantages={avantages}
      libellePrincipal={bouton}
      libelleSecondaire={t("rappel_essai_plus_tard", langue)}
      onPrincipal={allerPlans}
      onSecondaire={fermerPaywall}
    />
  );
}
