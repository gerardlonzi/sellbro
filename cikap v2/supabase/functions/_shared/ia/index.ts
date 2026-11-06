// Registre des fournisseurs IA + chaîne de BASCULEMENT pilotée par la base.
//
// Table `ia_providers` : `actif` (interrupteur), `priorite` (petit = d'abord),
// `capacites` (vision / audio), modèles et délai par fournisseur. Si un appel
// échoue (panne, quota, délai, clé invalide, réponse illisible), on passe au
// suivant AUTOMATIQUEMENT. Couper un fournisseur : update ia_providers set
// actif=false where id='openai' — sans redéployer ni republier l'app.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Capacite, ErreurFournisseur, FournisseurIA } from "./types.ts";
import { openai } from "./openai.ts";
import { gemini } from "./gemini.ts";
import { grok } from "./grok.ts";

export const REGISTRE_IA: Record<string, FournisseurIA> = { openai, gemini, grok };

export type CandidatIA = { fournisseur: FournisseurIA; cle: string; modele: string; delaiMs: number };

export async function chaineIA(admin: SupabaseClient, capacite: Capacite): Promise<CandidatIA[]> {
  const { data, error } = await admin
    .from("ia_providers")
    .select("id, actif, priorite, capacites, modele_vision, modele_audio, delai_ms")
    .eq("actif", true)
    .order("priorite", { ascending: true });

  // Migration pas encore appliquée : comportement historique (OpenAI seul).
  const lignes: any[] = error || !data ? [{ id: "openai", capacites: ["vision", "audio"] }] : data;

  const chaine: CandidatIA[] = [];
  for (const l of lignes) {
    const f = REGISTRE_IA[l.id];
    if (!f) continue;
    if (l.capacites?.length && !l.capacites.includes(capacite)) continue;
    if (capacite === "vision" && !f.analyserImage) continue;
    if (capacite === "audio" && !f.transcrire) continue;
    const cle = Deno.env.get(f.secretEnv);
    if (!cle) continue; // pas de clé posée = fournisseur inutilisable
    const modele = capacite === "vision"
      ? (l.modele_vision ?? f.modeleVisionDefaut ?? "")
      : (l.modele_audio ?? f.modeleAudioDefaut ?? "");
      chaine.push({
        fournisseur: f,
        cle,
        modele,
        delaiMs: Number(l.delai_ms) > 0
          ? Number(l.delai_ms)
          : 25000
      });  }
  return chaine;
}

export type ResultatChaine<T> =
  | { ok: true; valeur: T; fournisseur: string; essais: string[] }
  | { ok: false; essais: string[]; aucun: boolean };

// Essaie chaque candidat dans l'ordre jusqu'au premier succès. `traiter`
// reçoit le candidat et peut lever une erreur (y compris « réponse illisible »)
// pour forcer le passage au suivant. Chaque tentative est journalisée.
export async function executerAvecBasculement<T>(
  admin: SupabaseClient,
  userId: string,
  capacite: Capacite,
  chaine: CandidatIA[],
  traiter: (c: CandidatIA) => Promise<T>
): Promise<ResultatChaine<T>> {
  const essais: string[] = [];
  for (const c of chaine) {
    const debut = Date.now();
    try {
      const valeur = await traiter(c);
      journaliser(admin, userId, capacite, c.fournisseur.id, true, Date.now() - debut, null);
      return { ok: true, valeur, fournisseur: c.fournisseur.id, essais };
    } catch (e) {
      const message = e instanceof ErreurFournisseur ? e.message : `[${c.fournisseur.id}] ${e}`;
      console.error(`IA ${capacite} en échec :`, message);
      essais.push(message.slice(0, 200));
      journaliser(admin, userId, capacite, c.fournisseur.id, false, Date.now() - debut, message.slice(0, 500));
    }
  }
  return { ok: false, essais, aucun: chaine.length === 0 };
}

// Journal best-effort (ne doit JAMAIS faire échouer la requête).
function journaliser(admin: SupabaseClient, userId: string, capacite: string, fournisseur: string, ok: boolean, dureeMs: number, erreur: string | null) {
  admin.from("ia_appels_log")
    .insert({ user_id: userId, capacite, fournisseur, ok, duree_ms: dureeMs, erreur })
    .then(() => {}, () => {});
}
