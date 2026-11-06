// Prix d'un plan dans la devise du client — MÊME règle que l'app
// (lib/currency/taux.ts) pour que le montant affiché = le montant facturé :
//   1) le prix de base vient de la table `plans` (colonne `prix`, en FCFA/XAF) ;
//   2) il est converti avec les taux de `app_config.taux_conversion` (la même
//      source que l'app) ;
//   3) `plans.prix_par_devise` reste une SURCHARGE OPTIONNELLE (ex. arrondi
//      commercial « 30 GHS ») : si elle existe pour la devise, elle prime.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { obtenirTaux } from "./taux.ts";

// Taux de secours — miroir de TAUX_DEPUIS_FCFA dans l'app.
const TAUX_SECOURS: Record<string, number> = {
  XAF: 1, XOF: 1, CDF: 5.0, GHS: 0.02202, GNF: 15.2, KES: 0.2289,
  MWK: 3.09, NGN: 2.2371, RWF: 2.6091, TZS: 4.6759, UGX: 6.4, ZMW: 0.04,
};

export function convertirDepuisFcfa(montantFcfa: number, taux: number): number {
  const valeur = montantFcfa * taux;
  return taux >= 1 ? Math.round(valeur) : Math.max(1, Math.round(valeur));
}

export async function prixPourDevise(
  admin: SupabaseClient,
  planId: string,
  devise: string
): Promise<{ montant: number } | { erreur: "plan_introuvable" | "prix_invalide" }> {
  const { data: plan } = await admin.from("plans").select("prix, prix_par_devise, actif").eq("id", planId).maybeSingle();
  if (!plan || plan.actif === false) return { erreur: "plan_introuvable" };

  const surcharge = plan.prix_par_devise?.[devise];
  if (surcharge != null && Number.isFinite(Number(surcharge)) && Number(surcharge) > 0) {
    return { montant: Number(surcharge) };
  }

  const base = Number(plan.prix);
  if (!Number.isFinite(base) || base <= 0) return { erreur: "prix_invalide" };
  if (devise === "XAF") return { montant: base };

  // Taux « temps réel » (API, actualisés au plus toutes les 6 h) + taux manuels.
  let taux: number | undefined;
  try {
    const tous = await obtenirTaux(admin);
    if (Number.isFinite(Number(tous[devise]))) taux = Number(tous[devise]);
  } catch {
    // Config illisible : taux de secours.
  }
  if (!taux || !Number.isFinite(taux)) taux = TAUX_SECOURS[devise];
  if (!taux || !Number.isFinite(taux)) return { erreur: "prix_invalide" };
  return { montant: convertirDepuisFcfa(base, taux) };
}
