// Route cible du deep link cikap://premium/retour (return_url du checkout
// SasPay après paiement réussi). Ce n'est PAS une preuve de paiement : on
// renvoie simplement vers l'écran de paiement, qui suit le statut réel via
// Supabase (webhook + verify-payment).
import { Redirect } from "expo-router";

export default function RetourPaiement() {
  return <Redirect href="/premium/paiement" />;
}
