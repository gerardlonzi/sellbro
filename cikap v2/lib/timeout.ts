// Enveloppe une promesse (ou un thenable Supabase) avec un délai maximum.
// Indispensable hors ligne : les appels réseau peuvent rester pendus
// indéfiniment et bloquer tout l'affichage (plan, essai, notifications).
export function avecTimeout<T>(p: PromiseLike<T>, ms = 5000): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout_reseau")), ms)),
  ]);
}
