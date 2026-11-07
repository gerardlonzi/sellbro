import { Redirect } from "expo-router";

// Ancien écran OCR (flux de démonstration) : remplacé par le scanner intelligent.
export default function ScanVenteHeritage() {
  return <Redirect href="/scan-facture" />;
}
