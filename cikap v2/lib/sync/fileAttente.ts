import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";

const CLE_FILE = "file_synchronisation";

type ElementEnAttente = { id: string; table: string; donnees: any; cree_le: string };

async function lireFile(): Promise<ElementEnAttente[]> {
  const json = await AsyncStorage.getItem(CLE_FILE);
  return json ? JSON.parse(json) : [];
}

async function ecrireFile(elements: ElementEnAttente[]) {
  await AsyncStorage.setItem(CLE_FILE, JSON.stringify(elements));
}

// Tente un envoi direct à Supabase ; si ça échoue (hors ligne, erreur
// réseau), met en file d'attente locale au lieu de perdre la donnée.
export async function enregistrerAvecSyncDifferee(table: string, donnees: any) {
  try {
    const { error } = await supabase.from(table).insert(donnees);
    if (!error) return { succes: true, enAttente: false };
    throw error;
  } catch {
    const file = await lireFile();
    file.push({ id: `local-${Date.now()}-${Math.random()}`, table, donnees, cree_le: new Date().toISOString() });
    await ecrireFile(file);
    return { succes: true, enAttente: true };
  }
}

export async function nombreEnAttente(): Promise<number> {
  return (await lireFile()).length;
}

// À appeler dès que la connexion revient (voir hook ci-dessous).
export async function traiterFileAttente(): Promise<{ reussies: number; echecs: number }> {
  const file = await lireFile();
  if (file.length === 0) return { reussies: 0, echecs: 0 };

  const restants: ElementEnAttente[] = [];
  let reussies = 0;

  for (const element of file) {
    const { error } = await supabase.from(element.table).insert(element.donnees);
    if (error) restants.push(element);
    else reussies++;
  }

  await ecrireFile(restants);
  return { reussies, echecs: restants.length };
}