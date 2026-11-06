// Diagnostic des prérequis IA / paiement (Réglages → Diagnostic).
// Ne révèle JAMAIS de secret : seulement « présent / absent / valide ».
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { planEffectifIA } from "./accesIA.ts";
import { REGISTRE_IA } from "./ia/index.ts";
import { REGISTRE as REGISTRE_PAIEMENT } from "./providers/index.ts";

export type Controle = { cle: string; ok: boolean; detail?: string };

export async function diagnostiquerIA(admin: SupabaseClient, userId: string): Promise<Controle[]> {
  const r: Controle[] = [];

  // 1) Fournisseurs IA : chaque clé posée est testée (appel gratuit).
  const operationnels: string[] = [];
  for (const f of Object.values(REGISTRE_IA)) {
    const cle = Deno.env.get(f.secretEnv);
    if (!cle) {
      r.push({ cle: `ia_${f.id}`, ok: true, detail: `Non configuré (secret ${f.secretEnv} absent) — ignoré` });
      continue;
    }
    try {
      const t = await f.verifierCle(cle);
      if (t.ok) operationnels.push(f.id);
      r.push({ cle: `ia_${f.id}`, ok: t.ok, detail: t.detail });
    } catch (e) {
      r.push({ cle: `ia_${f.id}`, ok: false, detail: `Injoignable : ${e}` });
    }
  }
  r.push({
    cle: "ia_au_moins_un",
    ok: operationnels.length > 0,
    detail: operationnels.length > 0
      ? `Opérationnels : ${operationnels.join(", ")}`
      : "AUCUN fournisseur IA opérationnel : pose au moins OPENAI_API_KEY ou GEMINI_API_KEY (supabase secrets set …)",
  });

  // 2) Fournisseurs de paiement : clés posées (sans appel facturable).
  const paiement = Object.values(REGISTRE_PAIEMENT).filter((f) => Deno.env.get(f.secretEnv)).map((f) => f.id);
  r.push({
    cle: "paiement_cles",
    ok: paiement.length > 0,
    detail: paiement.length > 0 ? `Clés présentes : ${paiement.join(", ")}` : "Aucune clé de paiement (SASPAY_SECRET_KEY…)",
  });

  // 3) Tables / vues nécessaires.
  const tables: [string, string][] = [
    ["document_scans", "Migration 20261004_scanner_documents.sql non appliquée"],
    ["ia_providers", "Migration 20261023 non appliquée (la bascule IA utilise alors OpenAI seul)"],
    ["payment_providers", "Migration 20261023 non appliquée (paiement : SasPay seul)"],
    ["preferences_utilisateur", "Migration 20261023 non appliquée (préférences non synchronisées)"],
    ["plan_utilisateur", "Vue plan_utilisateur absente"],
    ["plans", "Table plans absente"],
    ["essais_gratuits", "Table essais_gratuits absente"],
  ];
  for (const [nom, aide] of tables) {
    const { error } = await admin.from(nom).select("*", { head: true, count: "exact" }).limit(1);
    r.push({ cle: `table_${nom}`, ok: !error, detail: error ? `${aide} (${error.message})` : "OK" });
  }

  // 4) Plan effectif et quotas IA de CET utilisateur.
  try {
    const p = await planEffectifIA(admin, userId);
    r.push({
      cle: "plan_ia",
      ok: p.quotaScan > 0 && p.quotaVocal > 0,
      detail: `plan=${p.planId} quota_scan=${p.quotaScan} quota_vocal=${p.quotaVocal}` +
        (p.quotaScan > 0 ? "" : " → l'IA est refusée pour ce plan (normal pour Starter / Gratuit)"),
    });
  } catch (e) {
    r.push({ cle: "plan_ia", ok: false, detail: `Lecture du plan impossible : ${e}` });
  }
  return r;
}
