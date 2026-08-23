import { supabase } from "@/lib/supabase/client";
import { obtenirIdentifiantAppareil } from "@/lib/trial/deviceTrial";

const MAX_COMPTES_PAR_APPAREIL = 3; // au-delà, on bloque (usage familial/partagé raisonnable)

export async function verifierLimiteAppareil(): Promise<boolean> {
  const identifiant = await obtenirIdentifiantAppareil();

  const { data } = await supabase
    .from("inscriptions_appareil")
    .select("nombre_comptes")
    .eq("identifiant_appareil", identifiant)
    .maybeSingle();

  if (data && data.nombre_comptes >= MAX_COMPTES_PAR_APPAREIL) {
    return false; // bloqué
  }
  return true;
}

export async function enregistrerInscriptionAppareil() {
  const identifiant = await obtenirIdentifiantAppareil();

  const { data } = await supabase
    .from("inscriptions_appareil")
    .select("nombre_comptes")
    .eq("identifiant_appareil", identifiant)
    .maybeSingle();

  if (data) {
    await supabase
      .from("inscriptions_appareil")
      .update({ nombre_comptes: data.nombre_comptes + 1, derniere_inscription: new Date().toISOString() })
      .eq("identifiant_appareil", identifiant);
  } else {
    await supabase.from("inscriptions_appareil").insert({ identifiant_appareil: identifiant });
  }
}