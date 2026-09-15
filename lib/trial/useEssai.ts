import { useEffect, useState, useCallback } from "react";
import { obtenirEtatEssaiLocal, demarrerOuVerifierEssaiGratuit, EtatEssai } from "./deviceTrial";
import { usePlanActuel } from "@/lib/plan/usePlanActuel";
import { supabase } from "@/lib/supabase/client";

// Statut central de l'utilisateur — LA source de vérité unique pour l'accès.
//  - TRIAL : essai gratuit actif → accès complet temporaire.
//  - PRO   : abonnement payant actif → accès complet.
//  - FREE  : ni essai ni abonnement → accès restreint (lecture seule).
export type Statut = "TRIAL" | "FREE" | "PRO";

export function calculerStatut(estPremium: boolean, essaiActif: boolean): Statut {
  if (estPremium) return "PRO";
  if (essaiActif) return "TRIAL";
  return "FREE";
}

// L'utilisateur a-t-il un accès complet (lecture + écriture) ?
export function aAccesComplet(statut: Statut): boolean {
  return statut === "PRO" || statut === "TRIAL";
}

// Lit la config d'essai depuis la base : la durée vient de
// `app_config.duree_essai_jours`, le prix du plan Pro de `plans` (id = premium).
async function chargerConfigEssai(): Promise<{ dureeTotale: number; prix: number }> {
  try {
    const [cfg, planPro] = await Promise.all([
      supabase.from("app_config").select("valeur").eq("cle", "duree_essai_jours").single(),
      supabase.from("plans").select("prix").eq("id", "premium").single(),
    ]);
    const dureeTotale = cfg.data?.valeur ? parseInt(cfg.data.valeur, 10) || 2 : 2;
    const prix = planPro.data?.prix ?? "····";
    return { dureeTotale, prix };
  } catch {
    return { dureeTotale: 2, prix: 2500 };
  }
}

export type EssaiInfo = {
  estPremium: boolean;
  actif: boolean;
  statut: Statut;
  joursRestants: number;
  dureeTotale: number;
  prix: number;
  dateFin: string | null;
  pret: boolean;
  recharger: () => Promise<void>;
};

// État unifié de l'essai / abonnement, pour l'affichage (Settings, Accueil,
// pop-ups) et la logique de rappels. La durée totale et le prix viennent de la
// base, les jours restants sont recalculés localement depuis dateFin.
export function useEssai(): EssaiInfo {
  const { planId, pret: planPret } = usePlanActuel();
  const [etat, setEtat] = useState<EtatEssai>({ actif: true, joursRestants: 0, dateFin: null });
  const [config, setConfig] = useState({ dureeTotale: 2, prix: 2500 });
  const [pret, setPret] = useState(false);

  useEffect(() => {
    let actif = true;
    (async () => {
      // 1) État LOCAL d'abord : l'affichage (badge plan, carte réglages)
      // fonctionne immédiatement, même hors ligne.
      const local = await obtenirEtatEssaiLocal();
      if (actif) {
        setEtat(local);
        setPret(true);
      }

      // 2) Rafraîchissement serveur en arrière-plan (ignoré hors ligne).
      try {
        const serveur = await demarrerOuVerifierEssaiGratuit();
        const localAJour = await obtenirEtatEssaiLocal();
        if (actif) setEtat(localAJour.actif || serveur.actif ? localAJour : serveur);

        // Lit la durée d'essai + le prix Pro depuis la base (configurable).
        const conf = await chargerConfigEssai();
        if (actif) setConfig(conf);
      } catch {
        // Hors ligne : on garde l'état local.
      }
    })();
    return () => {
      actif = false;
    };
  }, []);

  const estPremium = planId === "premium";
  const statut = calculerStatut(estPremium, etat.actif);

  // Recharge l'état de l'essai (jours restants recalculés depuis dateFin).
  // À appeler au focus pour que « X jours restants » reste à jour.
  const recharger = useCallback(async () => {
    const serveur = await demarrerOuVerifierEssaiGratuit();
    const local = await obtenirEtatEssaiLocal();
    setEtat(local.actif || serveur.actif ? local : serveur);
    const conf = await chargerConfigEssai();
    setConfig(conf);
  }, []);

  return {
    estPremium,
    // `actif` = accès complet (PRO ou essai actif) — conservé pour compat.
    actif: estPremium || etat.actif,
    statut,
    joursRestants: etat.joursRestants,
    dureeTotale: config.dureeTotale,
    prix: config.prix,
    dateFin: etat.dateFin,
    recharger,
    // Prêt quand le plan ET l'essai ET la config sont chargés (évite le flash).
    pret: planPret && pret,
  };
}