// Taux de change « temps réel » (1 XAF = x devise), stockés dans app_config :
//   taux_conversion        JSON  {"EUR":0.00152,"USD":0.0016,...}  ← lu par l'app ET par le paiement
//   taux_conversion_maj    ISO   date de la dernière actualisation
//   taux_conversion_manuel JSON  (optionnel) taux imposés par vous : ils PRIMENT sur l'API
// Une seule source pour l'affichage (app) et la facturation (create-checkout).
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL_API = "https://open.er-api.com/v6/latest/XAF"; // gratuit, sans clé
export const FRAICHEUR_MS = 6 * 3600 * 1000;      // au-delà : on actualise
const INTERVALLE_MIN_MS = 3600 * 1000;            // jamais plus d'1 appel d'API / heure

function lireJson(texte?: string | null): Record<string, number> {
  try {
    const o = texte ? JSON.parse(texte) : {};
    const r: Record<string, number> = {};
    for (const [k, v] of Object.entries(o)) if (Number.isFinite(Number(v)) && Number(v) > 0) r[k] = Number(v);
    return r;
  } catch {
    return {};
  }
}

export async function lireTaux(admin: SupabaseClient) {
  const { data } = await admin.from("app_config").select("cle, valeur")
    .in("cle", ["taux_conversion", "taux_conversion_maj", "taux_conversion_manuel"]);
  const l = Object.fromEntries((data ?? []).map((x: any) => [x.cle, x.valeur as string]));
  const maj = l.taux_conversion_maj ? new Date(l.taux_conversion_maj).getTime() : 0;
  return { taux: lireJson(l.taux_conversion), manuel: lireJson(l.taux_conversion_manuel), maj };
}

// Retourne les taux à jour (actualise via l'API si périmés). Ne jette jamais :
// si l'API est injoignable, on garde les derniers taux connus.
export async function obtenirTaux(admin: SupabaseClient, forcer = false): Promise<Record<string, number>> {
  const { taux, manuel, maj } = await lireTaux(admin);
  const age = Date.now() - maj;
  if (!forcer && age < FRAICHEUR_MS) return { ...taux, ...manuel };
  if (age < INTERVALLE_MIN_MS && !forcer) return { ...taux, ...manuel };

  try {
    const r = await fetch(URL_API, { signal: AbortSignal.timeout(8000) });
    const corps = await r.json();
    if (corps?.result !== "success" || !corps?.rates) throw new Error("réponse API invalide");
    const frais: Record<string, number> = {};
    for (const [k, v] of Object.entries(corps.rates as Record<string, number>)) {
      if (Number.isFinite(Number(v)) && Number(v) > 0) frais[k] = Number(v);
    }
    frais.XAF = 1;
    const fusion = { ...taux, ...frais }; // on garde les devises que l'API ne renvoie pas
    await admin.from("app_config").upsert([
      { cle: "taux_conversion", valeur: JSON.stringify(fusion), type: "json" },
      { cle: "taux_conversion_maj", valeur: new Date().toISOString(), type: "text" },
    ], { onConflict: "cle" });
    return { ...fusion, ...manuel };
  } catch (e) {
    console.error("actualisation des taux impossible:", String(e));
    return { ...taux, ...manuel };
  }
}
