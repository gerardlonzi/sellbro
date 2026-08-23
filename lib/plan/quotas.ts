import { supabase } from "@/lib/supabase/client";

export type PlanId = "gratuit" | "starter" | "premium";

export type Plan = {
  id: PlanId;
  nom: string;
  actif: boolean;
  prix: number;
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
};

// Valeurs de secours si la lecture Supabase échoue (hors ligne, erreur
// réseau) — l'app doit toujours pouvoir démarrer, même sans connexion.
const PLANS_PAR_DEFAUT: Record<PlanId, Plan> = {
  gratuit: {
    id: "gratuit", nom: "Gratuit", actif: true, prix: 0,
    quotaVocal: 4, quotaScan: 4, quotaProduits: 30, quotaCreances: 15,
    historiqueJours: 7, rapportsMax: "semaine",
    exportComptable: false, sauvegardeCloud: false, multiEmployes: false, supportPrioritaire: false,
  },
  starter: {
    id: "starter", nom: "Starter", actif: true, prix: 1500,
    quotaVocal: 150, quotaScan: 350, quotaProduits: null, quotaCreances: null,
    historiqueJours: null, rapportsMax: "annee",
    exportComptable: true, sauvegardeCloud: true, multiEmployes: false, supportPrioritaire: false,
  },
  premium: {
    id: "premium", nom: "Premium", actif: true, prix: 2000,
    quotaVocal: 300, quotaScan: 570, quotaProduits: null, quotaCreances: null,
    historiqueJours: null, rapportsMax: "annee",
    exportComptable: true, sauvegardeCloud: true, multiEmployes: true, supportPrioritaire: true,
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