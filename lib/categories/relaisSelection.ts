let callback: ((nom: string) => void) | null = null;

export function ecouterSelectionCategorie(cb: (nom: string) => void) {
  callback = cb;
}

export function envoyerSelectionCategorie(nom: string) {
  callback?.(nom);
}