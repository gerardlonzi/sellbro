// Préférences utilisateur synchronisées avec Supabase (table preferences_utilisateur).
//
// Principe « local d'abord » : une préférence est TOUJOURS écrite en local
// (AsyncStorage) immédiatement — donc elle marche hors ligne — puis fusionnée
// avec le serveur à la prochaine synchro. En cas de conflit, la modification la
// plus récente gagne (horodatage par clé). Un nouvel appareil retrouve ainsi les
// réglages de notifications, thème, modes d'affichage, objectifs…
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import { avecTimeout } from "@/lib/timeout";
import { obtenirUserId } from "@/lib/auth/userCache";

const PREFIXES = ["notif_", "theme_mode", "stock_mode_affichage", "vente_mode_affichage", "objectif_journalier_", "boutika_tour_termine"];
// États techniques purement locaux (anti-doublon de notifications, etc.).
const EXCLUS = ["notif_seuil_envoyes", "notif_cache", "notif_lues_locales", "notif_file"];
const CLE_META = "prefs_meta_v1";

export function estPreferenceSynchronisee(cle: string): boolean {
  if (EXCLUS.some((e) => cle.startsWith(e))) return false;
  return PREFIXES.some((p) => cle.startsWith(p));
}

async function lireMeta(): Promise<Record<string, number>> {
  try {
    return JSON.parse((await AsyncStorage.getItem(CLE_META)) ?? "{}");
  } catch {
    return {};
  }
}

// Enregistre une préférence (local immédiat) et tente une synchro discrète.
export async function sauverPreference(cle: string, valeur: string): Promise<void> {
  await AsyncStorage.setItem(cle, valeur);
  if (!estPreferenceSynchronisee(cle)) return;
  const meta = await lireMeta();
  meta[cle] = Date.now();
  await AsyncStorage.setItem(CLE_META, JSON.stringify(meta));
  synchroniserPreferencesSilencieux();
}

let enCours: Promise<void> | null = null;

export function synchroniserPreferencesSilencieux(): void {
  obtenirUserId()
    .then((id) => (id ? synchroniserPreferences(id) : undefined))
    .catch(() => {});
}

// Fusion local ↔ serveur (dernier écrit gagne, par clé).
export function synchroniserPreferences(userId: string): Promise<void> {
  if (enCours) return enCours;
  enCours = fusionner(userId).finally(() => { enCours = null; });
  return enCours;
}

async function fusionner(userId: string): Promise<void> {
  const { data, error } = await avecTimeout(
    supabase.from("preferences_utilisateur").select("donnees").eq("user_id", userId).maybeSingle(),
    8000
  );
  if (error) return; // table absente / hors ligne : on réessaiera à la prochaine synchro
  const distant: Record<string, { v: string; t: number }> = (data?.donnees as any) ?? {};
  const meta = await lireMeta();

  const toutes = await AsyncStorage.getAllKeys();
  const locales = toutes.filter(estPreferenceSynchronisee);
  const cles = new Set<string>([...locales, ...Object.keys(distant)]);

  let aPousser = false;
  const maintenant = Date.now();
  for (const cle of cles) {
    const tLocal = meta[cle] ?? 0;
    const tDistant = distant[cle]?.t ?? 0;
    if (tDistant > tLocal) {
      await AsyncStorage.setItem(cle, distant[cle].v);
      meta[cle] = tDistant;
    } else {
      const valeur = await AsyncStorage.getItem(cle);
      if (valeur == null) continue;
      if (tLocal > tDistant || (tLocal === 0 && !distant[cle])) {
        const t = tLocal || maintenant;
        distant[cle] = { v: valeur, t };
        meta[cle] = t;
        aPousser = true;
      }
    }
  }
  await AsyncStorage.setItem(CLE_META, JSON.stringify(meta));
  if (aPousser) {
    await supabase.from("preferences_utilisateur").upsert({ user_id: userId, donnees: distant, updated_at: new Date().toISOString() });
  }
}
