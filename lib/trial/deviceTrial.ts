import * as Application from "expo-application";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase/client";

export async function obtenirIdentifiantAppareil(): Promise<string> {
  if (Platform.OS === "android") {
    return Application.getAndroidId() ?? "inconnu-android";
  }
  const id = await Application.getIosIdForVendorAsync();
  return id ?? "inconnu-ios";
  // Note iOS : cet identifiant peut se réinitialiser si TOUTES les apps
  // du même développeur sont désinstallées du téléphone. Ce n'est donc
  // pas 100% infaillible sur iOS, mais ça reste la meilleure option
  // gratuite disponible sans compte utilisateur.
}

export async function demarrerOuVerifierEssaiGratuit(): Promise<{ actif: boolean; joursRestants: number }> {
  const identifiant = await obtenirIdentifiantAppareil();

  const { data: essaiExistant } = await supabase
    .from("essais_gratuits")
    .select("date_fin")
    .eq("identifiant_appareil", identifiant)
    .maybeSingle();

  if (essaiExistant) {
    const joursRestants = Math.max(
      0,
      Math.ceil((new Date(essaiExistant.date_fin).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );
    return { actif: joursRestants > 0, joursRestants };
  }

  const dateFin = new Date();
  dateFin.setDate(dateFin.getDate() + 14);

  await supabase.from("essais_gratuits").insert({
    identifiant_appareil: identifiant,
    date_fin: dateFin.toISOString(),
  });

  return { actif: true, joursRestants: 14 };
}