import { supabase } from "@/lib/supabase/client";

export type PlanId = "gratuit" | "premium";

export type Plan = {
  id: PlanId;
  nom: string;
  actif: boolean;
  prix: number;
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

// Modèle 2 formules : « Essai gratuit » (toutes les fonctionnalités Premium,
// limité dans le temps par le gate) et « Premium » (illimité).
// Le blocage temporel de l'essai est géré par peutEcrire() / l'expiration,
// PAS par des quotas — d'où des fonctionnalités identiques au Premium.
const PLANS_PAR_DEFAUT: Record<PlanId, Plan> = {
  gratuit: {
    id: "gratuit", nom: "Essai gratuit", actif: true, prix: 3000, dureeEssaiJours: 3, estEssaiGratuit: true,
    quotaVocal: 300, quotaScan: 570, quotaProduits: null, quotaCreances: null,
    historiqueJours: null, rapportsMax: "annee",
    exportComptable: true, sauvegardeCloud: true, multiEmployes: true, supportPrioritaire: true,
    factures: true, fournisseurs: true, depenses: true,
  },
  premium: {
    id: "premium", nom: "Premium", actif: true, prix: 2000, dureeEssaiJours: null, estEssaiGratuit: false,
    quotaVocal: 300, quotaScan: 570, quotaProduits: null, quotaCreances: null,
    historiqueJours: null, rapportsMax: "annee",
    exportComptable: true, sauvegardeCloud: true, multiEmployes: true, supportPrioritaire: true,
    factures: true, fournisseurs: true, depenses: true,
  },
};

let planCache: Record<PlanId, Plan> | null = null;

export async function chargerPlans(): Promise<Record<PlanId, Plan>> {
  if (planCache) return planCache;

  const { data, error } = await supabase.from("plans").select("*");

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