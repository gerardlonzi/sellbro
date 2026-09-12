import { enregistrerSuppression } from "@/lib/sync/tombstones";

// Supprime un enregistrement local en mémorisant sa suppression côté cloud
// (tombstone) si l'enregistrement avait déjà été synchronisé. À utiliser à la
// place de `destroyPermanently()` partout où l'on supprime une donnée métier.
export async function supprimerEnregistrement(table: string, enreg: any): Promise<void> {
  if (enreg.remoteId) {
    await enregistrerSuppression(table, enreg.remoteId);
  }
  await enreg.destroyPermanently();
}