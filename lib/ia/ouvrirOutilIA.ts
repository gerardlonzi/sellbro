import { router } from "expo-router";
import { Langue } from "@/lib/i18n";
import { afficherPaywall } from "@/lib/trial/paywall";

// Ouvre le scan ou le vocal si le compte y a droit ; sinon affiche tout de
// suite la popup « réservé à Premium » (au lieu d'ouvrir l'écran pour rien).
export function ouvrirOutilIA(route: "/scan-facture" | "/vente/vocal", acces: boolean, langue: Langue) {
  if (!acces) {
    afficherPaywall(langue, () => router.push("/premium"), { raison: "ia" });
    return;
  }
  router.push(route);
}
