// État global de synchronisation, pour afficher un indicateur
// « Synchronisation… » / « Synchronisation terminée » (notamment au login
// sur un nouvel appareil).

export type EtatSync = "idle" | "syncing" | "complete" | "error";

let etat: EtatSync = "idle";
const abonnes = new Set<(e: EtatSync) => void>();

export function getEtatSync(): EtatSync {
  return etat;
}

export function setEtatSync(e: EtatSync): void {
  etat = e;
  abonnes.forEach((cb) => cb(e));
}

export function sAbonnerSync(cb: (e: EtatSync) => void): () => void {
  abonnes.add(cb);
  cb(etat);
  return () => {
    abonnes.delete(cb);
  };
}