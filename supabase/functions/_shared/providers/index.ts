// Registre des fournisseurs de paiement + sélection PILOTÉE PAR LA BASE.
//
// Table `payment_providers` : `actif` (interrupteur), `priorite` (plus petit =
// préféré), `pays` / `devises` (liste vide = tous). Couper un agrégateur en
// panne = `update payment_providers set actif = false where id = 'saspay'` :
// la requête suivante bascule sur le suivant, sans redéployer ni republier l'app.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { FournisseurPaiement } from "./types.ts";
import { saspay } from "./saspay.ts";
import { flutterwave } from "./flutterwave.ts";

export const REGISTRE: Record<string, FournisseurPaiement> = {
  saspay,
  flutterwave,
};

export type Candidat = { fournisseur: FournisseurPaiement; cle: string };

export async function candidatsPaiement(admin: SupabaseClient, country: string, devise: string): Promise<Candidat[]> {
  const { data, error } = await admin
    .from("payment_providers")
    .select("id, actif, priorite, pays, devises")
    .eq("actif", true)
    .order("priorite", { ascending: true });

  // Migration pas encore appliquée (table absente) : comportement historique,
  // SasPay seul — l'app continue de fonctionner.
  const lignes = error || !data ? [{ id: "saspay", pays: [], devises: [] }] : data;

  const candidats: Candidat[] = [];
  for (const l of lignes) {
    const f = REGISTRE[l.id];
    if (!f) continue;
    if (l.pays?.length && !l.pays.includes(country)) continue;
    if (l.devises?.length && !l.devises.includes(devise)) continue;
    const cle = Deno.env.get(f.secretEnv);
    if (!cle) continue; // pas de clé posée = fournisseur inutilisable
    candidats.push({ fournisseur: f, cle });
  }
  return candidats;
}
