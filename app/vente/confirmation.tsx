import { Redirect } from "expo-router";

// Ancien écran de confirmation de démonstration (valeurs fictives) : remplacé
// par l'écran de validation réel du scanner / vocal.
export default function ConfirmationHeritage() {
  return <Redirect href="/scan-facture" />;
}
