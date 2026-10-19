import { supabase } from "@/lib/supabase/client";
import { avecTimeout } from "@/lib/timeout";

export type PlanId = "gratuit" | "starter" | "premium";

export type Plan = {
  id: PlanId;
  nom: string;
  actif: boolean;
  // null tant que le prix n'a pas été lu depuis la base — aucune valeur en dur.
  prix: number | null;
  dureeEssaiJours: number | null;
  estEssaiGratuit: boolean;
  quotaVocal: number;
  quotaScan: number;
  quotaProduits: number | null;
  quotaCreances: number | null;
  historiqueJours: number | null;
  rapportsMax: "jour" | "semaine" | "mois" | "semestre" | "annee";
  exportComptable: boolean;
  sauvegardeCloud: boolean;
  multiEmployes: boolean;
  supportPrioritaire: boolean;
  factures: boolean;
fournisseurs: boolean;
depenses: boolean;
};

// Modèle 3 formules :
//  - « Gratuit » : après l'essai, sans abonnement. Quotas LIMITÉS (20 produits
//    par défaut) — toutes les valeurs sont lues depuis la table `plans`, rien
//    n'est figé ici : ces défauts ne servent qu'en hors ligne sans cache.
//  - « Starter » : payant, quotas étendus (200 produits par défaut), SANS IA.
//  - « Premium » : illimité + IA (scan de documents, vocal).
// Le blocage temporel de l'essai est géré par peutEcrire() / l'expiration.
// Pendant l'essai (plan « gratuit » + essai actif), les quotas produits et
// créances ne s'appliquent pas : l'essai donne l'expérience Premium complète.
export const PLANS_PAR_DEFAUT: Record<PlanId, Plan> = {
  gratuit: {
    id: "gratuit", nom: "Gratuit", actif: true, prix: null, dureeEssaiJours: null, estEssaiGratuit: true,
    quotaVocal: 0, quotaScan: 0, quotaProduits: 20, quotaCreances: null,
    // Version gratuite : rapports limités à jour/semaine ; mois, semestre et
    // année affichent le paywall dans le dashboard.
    historiqueJours: null, rapportsMax: "semaine",
    exportComptable: false, sauvegardeCloud: false, multiEmployes: false, supportPrioritaire: false,
    factures: true, fournisseurs: true, depenses: true,
  },
  starter: {
    id: "starter", nom: "Starter", actif: true, prix: null, dureeEssaiJours: null, estEssaiGratuit: false,
    quotaVocal: 0, quotaScan: 0, quotaProduits: 200, quotaCreances: null,
    historiqueJours: null, rapportsMax: "mois",
    exportComptable: true, sauvegardeCloud: true, multiEmployes: false, supportPrioritaire: false,
    factures: true, fournisseurs: true, depenses: true,
  },
  premium: {
    id: "premium", nom: "Premium", actif: true, prix: null, dureeEssaiJours: null, estEssaiGratuit: false,
    quotaVocal: 300, quotaScan: 570, quotaProduits: null, quotaCreances: null,
    historiqueJours: null, rapportsMax: "annee",
    exportComptable: true, sauvegardeCloud: true, multiEmployes: true, supportPrioritaire: true,
    factures: true, fournisseurs: true, depenses: true,
  },
};

let planCache: Record<PlanId, Plan> | null = null;

export async function chargerPlans(): Promise<Record<PlanId, Plan>> {
  if (planCache) return planCache;

  // Hors ligne, l'appel peut rester pendu : timeout pour retomber vite sur
  // les valeurs par défaut au lieu de bloquer tout l'affichage du plan.
  let data: any[] | null = null;
  let error: any = null;
  try {
    const res = await avecTimeout(supabase.from("plans").select("*"), 5000);
    data = res.data;
    error = res.error;
  } catch (e) {
    error = e;
  }

  if (error || !data) {
    console.warn("Impossible de lire les plans depuis Supabase, utilisation des valeurs par défaut.");
    return PLANS_PAR_DEFAUT;
  }

  const resultat = { ...PLANS_PAR_DEFAUT };
  for (const ligne of data) {
    resultat[ligne.id as PlanId] = {
      id: ligne.id,
      nom: ligne.nom,
      actif: ligne.actif,
      prix: ligne.prix,
      dureeEssaiJours: ligne.duree_essai_jours ?? null,
      estEssaiGratuit: ligne.est_essai_gratuit ?? false,
      quotaVocal: ligne.quota_vocal,
      quotaScan: ligne.quota_scan,
      quotaProduits: ligne.quota_produits,
      quotaCreances: ligne.quota_creances,
      historiqueJours: ligne.historique_jours,
      rapportsMax: ligne.rapports_max,
      exportComptable: ligne.export_comptable,
      sauvegardeCloud: ligne.sauvegarde_cloud,
      multiEmployes: ligne.multi_employes,
      supportPrioritaire: ligne.support_prioritaire,
      factures: ligne.factures_actif,
      fournisseurs: ligne.fournisseurs_actif,
      depenses: ligne.depenses_actif,
    };
  }

  planCache = resultat;
  return resultat;
}

export function reinitialiserCachePlans() {
  planCache = null;
}

const ORDRE_PERIODES = ["jour", "semaine", "mois", "semestre", "annee"] as const;

export function periodesAutorisees(plan: Plan | undefined): typeof ORDRE_PERIODES[number][] {
  if (!plan) return ["jour", "semaine"]; // valeur de secours pendant le chargement
  const indexMax = ORDRE_PERIODES.indexOf(plan.rapportsMax);
  return ORDRE_PERIODES.slice(0, indexMax + 1);
}