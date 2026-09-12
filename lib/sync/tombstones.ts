import AsyncStorage from "@react-native-async-storage/async-storage";

// Mécanisme de « tombstones » : quand un enregistrement synchronisé est
// supprimé localement, on mémorise { table, remoteId } pour pouvoir le
// supprimer côté Supabase à la prochaine sync. Sans ça, le pull ré-importe
// l'enregistrement supprimé (bug « la créance réapparaît après refresh »).

const CLE = "sync_tombstones";

export type Suppression = { table: string; remoteId: string };

async function lire(): Promise<Suppression[]> {
  try {
    const brut = await AsyncStorage.getItem(CLE);
    return brut ? (JSON.parse(brut) as Suppression[]) : [];
  } catch {
    return [];
  }
}

export async function enregistrerSuppression(table: string, remoteId: string): Promise<void> {
  const liste = await lire();
  liste.push({ table, remoteId });
  await AsyncStorage.setItem(CLE, JSON.stringify(liste));
}

export async function lireSuppressions(): Promise<Suppression[]> {
  return lire();
}

export async function effacerSuppression(table: string, remoteId: string): Promise<void> {
  const liste = await lire();
  await AsyncStorage.setItem(CLE, JSON.stringify(liste.filter((s) => !(s.table === table && s.remoteId === remoteId))));
}