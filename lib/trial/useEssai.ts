import { useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
// AUCUNE valeur en dur : après le premier fetch réussi (en ligne), la config
// est mise en cache local pour le mode hors ligne. Sans réseau ni cache, on
// renvoie null — l'UI masque alors le prix au lieu d'afficher NaN.
const CLE_CONFIG_ESSAI = "config_essai_cache";

export type ConfigEssai = { dureeTotale: number | null; prix: number | null };

async function lireCacheConfig(): Promise<ConfigEssai> {
  try {
    const brut = await AsyncStorage.getItem(CLE_CONFIG_ESSAI);
    if (brut) return JSON.parse(brut) as ConfigEssai;
  } catch {}
  return { dureeTotale: null, prix: null };
}

async function chargerConfigEssai(): Promise<ConfigEssai> {
  try {
    const [cfg, planPro] = await Promise.all([
      supabase.from("app_config").select("valeur").eq("cle", "duree_essai_jours").single(),
      supabase.from("plans").select("prix").eq("id", "premium").single(),
    ]);
    const dureeTotale = cfg.data?.valeur ? parseInt(cfg.data.valeur, 10) : null;
    // Number.isFinite écarte aussi NaN (typeof NaN === "number") : sans ça,
    // un prix mal saisi en base s'affichait « NaN » dans l'app.
    const brut = planPro.data?.prix;
    const prix = typeof brut === "number" && Number.isFinite(brut) ? brut : null;
    const config: ConfigEssai = {
      dureeTotale: dureeTotale && Number.isFinite(dureeTotale) && dureeTotale > 0 ? dureeTotale : null,
      prix,
    };
    await AsyncStorage.setItem(CLE_CONFIG_ESSAI, JSON.stringify(config));
    return config;
  } catch {
    // Hors ligne : on retombe sur la dernière config connue, jamais sur une
    // valeur inventée.
    return lireCacheConfig();
  }
}

export type EssaiInfo = {
  estPremium: boolean;
  actif: boolean;
  statut: Statut;
  joursRestants: number;
  dureeTotale: number | null;
  prix: number | null;
  dateFin: string | null;
  pret: boolean;
  // `verifie` = on SAIT à quoi cet utilisateur a droit. `pret` ne le dit pas :
  // il passe à true dès la lecture locale, qui ne trouve rien sur une
  // installation neuve. Toute UI qui affiche un statut (ou un pop-up d'essai)
  // doit attendre `verifie`, sinon elle affiche « essai gratuit » à un Pro.
  verifie: boolean;
  recharger: () => Promise<void>;
};

// État unifié de l'essai / abonnement, pour l'affichage (Settings, Accueil,
// pop-ups) et la logique de rappels. La durée totale et le prix viennent de la
// base, les jours restants sont recalculés localement depuis dateFin.
export function useEssai(): EssaiInfo {
  const { planId, pret: planPret, verifie: planVerifie } = usePlanActuel();
  const [etat, setEtat] = useState<EtatEssai>({ actif: false, joursRestants: 0, dateFin: null, connu: false });
  const [config, setConfig] = useState<ConfigEssai>({ dureeTotale: null, prix: null });
  const [pret, setPret] = useState(false);

  useEffect(() => {
    let actif = true;
    (async () => {
      // 1) État LOCAL d'abord : l'affichage (badge plan, carte réglages)
      // fonctionne immédiatement, même hors ligne. La config (prix, durée)
      // vient du cache local — jamais de valeur en dur.
      const [local, configCachee] = await Promise.all([obtenirEtatEssaiLocal(), lireCacheConfig()]);
      if (actif) {
        setEtat(local);
        setConfig(configCachee);
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
  // Un abonné Pro est vérifié dès que son plan l'est : inutile de connaître
  // l'essai, qui ne le concerne pas. Pour les autres, il faut aussi savoir où
  // en est l'essai — sinon « inconnu » se lirait comme « terminé ».
  const verifie = planVerifie && (estPremium || etat.connu);

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
    // Sans date de fin, on ne connaît RIEN de l'essai de ce compte : on renvoie
    // 0 et l'appelant affiche un état neutre. Afficher `dureeTotale` ici faisait
    // apparaître « 3 jours restants » sur des comptes dont l'essai était expiré
    // depuis longtemps.
    joursRestants: etat.dateFin ? etat.joursRestants : 0,
    dureeTotale: config.dureeTotale,
    prix: config.prix,
    dateFin: etat.dateFin,
    recharger,
    // Prêt quand le plan ET l'essai ET la config sont chargés (évite le flash).
    pret: planPret && pret,
    verifie,
  };
}