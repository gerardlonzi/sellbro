// Garde-fou d'accès aux fonctionnalités IA (scan de documents, vocal).
//
// Règle métier :
//  - Premium → quotas de la ligne plans.premium (scan/vocal).
//  - Gratuit / Starter → quota 0 → accès refusé (l'IA est réservée au Premium).
//  - MAIS pendant l'ESSAI gratuit actif → quotas Premium (l'essai sert
//    précisément à découvrir l'IA).
//
// Toutes les limites viennent de la table `plans` : aucune valeur en dur.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function planEffectifIA(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<{ planId: string; quotaScan: number; quotaVocal: number }> {
  const { data: pu } = await supabaseAdmin
    .from("plan_utilisateur")
    .select("plan_id")
    .eq("user_id", userId)
    .maybeSingle();

  let planId: string = pu?.plan_id ?? "gratuit";

  if (planId === "gratuit") {
    const { data: essai } = await supabaseAdmin
      .from("essais_gratuits")
      .select("date_fin")
      .eq("user_id", userId)
      .maybeSingle();
    if (essai?.date_fin && new Date(essai.date_fin).getTime() > Date.now()) {
      planId = "premium";
    }
  }

  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("quota_scan, quota_vocal")
    .eq("id", planId)
    .single();

  return {
    planId,
    quotaScan: plan?.quota_scan ?? 0,
    quotaVocal: plan?.quota_vocal ?? 0,
  };
}
