// Compteur global de « version des données ». Incrémenté après chaque écriture
// ou synchronisation. Les écrans s'y abonnent pour ne recharger leurs données
// que lorsqu'il y a une vraie modification — pas à chaque navigation.

let version = 0;
const abonnes = new Set<() => void>();

export function versionDonnees(): number {
  return version;
}

export function signalerModificationDonnees() {
  version += 1;
  abonnes.forEach((cb) => cb());
}

export function sAbonnerModifications(cb: () => void): () => void {
  abonnes.add(cb);
  return () => {
    abonnes.delete(cb);
  };
}