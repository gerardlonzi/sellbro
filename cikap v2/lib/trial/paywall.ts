import { Langue } from "@/lib/i18n";

// État partagé du paywall : `afficherPaywall()` déclenche l'affichage de la
// modale personnalisée (components/PaywallPopup.tsx), au lieu d'un Alert natif.

export type OptionsPaywall = {
  // "ia" : fonction réservée à Premium (scan / vocal) — s'affiche AUSSI aux
  // abonnés Starter, avec un message dédié. Sans option : essai/abonnement fini.
  raison?: "ia";
};

export type EtatPaywall = {
  visible: boolean;
  langue: Langue;
  onUpgrade: () => void;
  raison?: "ia";
};

type Ecouteur = (etat: EtatPaywall) => void;

let ecouteur: Ecouteur | null = null;
let etat: EtatPaywall = { visible: false, langue: "fr", onUpgrade: () => {} };

export function sAbonnerPaywall(cb: Ecouteur): () => void {
  ecouteur = cb;
  cb(etat);
  return () => {
    ecouteur = null;
  };
}

export function afficherPaywall(langue: Langue, onUpgrade: () => void, options?: OptionsPaywall): void {
  etat = { visible: true, langue, onUpgrade, raison: options?.raison };
  ecouteur?.(etat);
}

export function fermerPaywall(): void {
  etat = { ...etat, visible: false };
  ecouteur?.(etat);
}
