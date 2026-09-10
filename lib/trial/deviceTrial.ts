import * as Application from "expo-application";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";

const CLE_ESSAI = "essai_gratuit_cache";

export async function obtenirIdentifiantAppareil(): Promise<string> {
  if (Platform.OS === "android") {
    return Application.getAndroidId() ?? "inconnu-android";
  }
  const id = await Application.getIosIdForVendorAsync();
  return id ?? "inconnu-ios";
}

export type EtatEssai = { actif: boolean; joursRestants: number; dateFin: string | null };

// Cache local : permet d'appliquer les sanctions MÊME HORS LIGNE.
// La date de fin provient du SERVEUR (jamais de la date du téléphone),
// donc l'utilisateur ne peut pas l'étendre en reculant sa date.
async function lireCache(): Promise<EtatEssai | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE_ESSAI);
    return brut ? (JSON.parse(brut) as EtatEssai) : null;
  } catch {
    return null;
  }
}

async function ecrireCache(etat: EtatEssai) {
  try {
    await AsyncStorage.setItem(CLE_ESSAI, JSON.stringify(etat));
  } catch {}
}

// Vérification 100% locale (hors ligne) de l'essai.
export async function estEssaiActifLocal(): Promise<boolean> {
  const cache = await lireCache();
  if (!cache || !cache.dateFin) return true; // essai jamais démarré → actif
  return new Date(cache.dateFin).getTime() > Date.now();
}

// Démarre ou vérifie l'essai via le SERVEUR (autorité), puis met à jour le cache.
export async function demarrerOuVerifierEssaiGratuit(): Promise<EtatEssai> {
  const identifiant = await obtenirIdentifiantAppareil();

  try {
    const { data, error } = await supabase.rpc("demarrer_essai", { identifiant });
    if (!error && Array.isArray(data) && data.length > 0) {
      const r = data[0];
      const etat: EtatEssai = {
        actif: r.jours_restants > 0,
        joursRestants: r.jours_restants,
        dateFin: r.date_fin,
      };
      await ecrireCache(etat);
      return etat;
    }
  } catch {
    // Hors ligne : on retombe sur le cache local.
  }

  const cache = await lireCache();
  if (cache) {
    const actif = cache.dateFin ? new Date(cache.dateFin).getTime() > Date.now() : true;
    return { ...cache, actif };
  }
  return { actif: true, joursRestants: 3, dateFin: null };
}