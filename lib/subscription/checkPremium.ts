import { supabase } from "../supabase/client";

// RÈGLE DE SÉCURITÉ : ne JAMAIS stocker "isPremium" uniquement en local
// (AsyncStorage, variable JS...). N'importe qui peut modifier une valeur
// locale sur son téléphone pour débloquer le Premium gratuitement.
// Cette fonction interroge toujours la vue `utilisateurs_premium` créée
// dans schema.sql, qui vérifie côté serveur que l'abonnement est actif
// ET non expiré.
export async function estPremium(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("utilisateurs_premium")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Vérification Premium impossible, accès refusé par sécurité.");
    return false; // en cas de doute, on refuse l'accès Premium plutôt que l'inverse
  }

  return data !== null;
}
