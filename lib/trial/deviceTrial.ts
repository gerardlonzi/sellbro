import * as Application from "expo-application";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import { obtenirUserId } from "@/lib/auth/userCache";
import { avecTimeout } from "@/lib/timeout";

const CLE_ESSAI = "essai_gratuit_cache";

export async function obtenirIdentifiantAppareil(): Promise<string> {
  if (Platform.OS === "android") {
    return Application.getAndroidId() ?? "inconnu-android";
  }
  const id = await Application.getIosIdForVendorAsync();
  return id ?? "inconnu-ios";
}

// `connu` distingue « l'essai est terminé » de « on n'a pas encore pu savoir ».
// Sans cette distinction, l'absence de cache (installation neuve, compte ancien
// jamais connecté sur cet appareil) était lue comme « essai actif » — d'où un
// compte Pro affiché en essai gratuit et un vieux compte affiché avec 3 jours
// restants à perpétuité.
export type EtatEssai = { actif: boolean; joursRestants: number; dateFin: string | null; connu: boolean };

// Cache local : permet d'appliquer les sanctions MÊME HORS LIGNE.
// La date de fin provient du SERVEUR (jamais de la date du téléphone),
// donc l'utilisateur ne peut pas l'étendre en reculant sa date.
async function lireCache(): Promise<EtatEssai | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE_ESSAI);
    if (!brut) return null;
    // Un cache écrit vient toujours d'une réponse serveur : c'est une connaissance.
    return { ...(JSON.parse(brut) as EtatEssai), connu: true };
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
  // Sans cache, on ne peut PAS présumer d'un droit qu'on n'a jamais vérifié.
  // Répondre `true` ici ouvrait l'écriture à un compte dont l'essai est expiré.
  if (!cache || !cache.dateFin) return false;
  return new Date(cache.dateFin).getTime() > Date.now();
}

// État local de l'essai, avec jours restants RECALCULÉS depuis dateFin
// (le `joursRestants` du cache peut être périmé). Utilisé pour l'affichage
// « Essai gratuit — X jours restants » et les rappels.
export async function obtenirEtatEssaiLocal(): Promise<EtatEssai> {
  const cache = await lireCache();
  if (cache?.dateFin) {
    const fin = new Date(cache.dateFin).getTime();
    const joursRestants = Math.ceil((fin - Date.now()) / 86400000);
    return {
      actif: joursRestants > 0,
      joursRestants: Math.max(0, joursRestants),
      dateFin: cache.dateFin,
      connu: true,
    };
  }
  // Aucun cache : on ne sait rien. L'appelant doit afficher un état neutre et
  // attendre la réponse serveur, jamais conclure « essai actif ».
  return { actif: false, joursRestants: 0, dateFin: null, connu: false };
}

// Démarre ou vérifie l'essai via le SERVEUR (autorité), puis met à jour le cache.
// (Test/dev uniquement) Simule un essai expiré localement, pour vérifier que
// les écritures sont bien bloquées en état « neutre » (ni essai ni Pro).
export async function simulerEssaiExpire(): Promise<void> {
  await ecrireCache({
    actif: false,
    joursRestants: 0,
    dateFin: new Date(Date.now() - 86400000).toISOString(),
    connu: true,
  });
}

// (Test/dev uniquement) Simule un essai gratuit ACTIF localement (état TRIAL).
export async function simulerEssaiActif(): Promise<void> {
  await ecrireCache({
    actif: true,
    joursRestants: 3,
    dateFin: new Date(Date.now() + 3 * 86400000).toISOString(),
    connu: true,
  });
}

export async function demarrerOuVerifierEssaiGratuit(): Promise<EtatEssai> {
  // Anti-abus : l'essai est lié au COMPTE (user_id), pas à l'appareil.
  const userId = await obtenirUserId();
  if (userId) {
    try {
      // Timeout : hors ligne l'appel peut rester pendu et geler l'écran.
      const { data, error } = await avecTimeout(supabase.rpc("demarrer_essai_user", { p_user_id: userId }), 6000);
      if (!error && Array.isArray(data) && data.length > 0) {
        const r = data[0];
        const etat: EtatEssai = {
          actif: r.jours_restants > 0,
          joursRestants: r.jours_restants,
          dateFin: r.date_fin,
          connu: true,
        };
        await ecrireCache(etat);
        return etat;
      }
    } catch {
      // Hors ligne : on retombe sur le cache local.
    }
  }

  const cache = await lireCache();
  if (cache) {
    const actif = cache.dateFin ? new Date(cache.dateFin).getTime() > Date.now() : false;
    return { ...cache, actif };
  }
  // Hors ligne sans cache : on ne sait rien. L'appelant affiche un état neutre
  // plutôt qu'un « X jours restants » calculé sur une durée qu'on n'a pas
  // confirmée pour CE compte.
  return { actif: false, joursRestants: 0, dateFin: null, connu: false };
}