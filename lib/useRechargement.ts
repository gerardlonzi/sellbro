import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { versionDonnees } from "@/lib/dataVersion";

// Recharge `charger` à chaque focus, mais seulement si les données ont changé
// depuis le dernier chargement. Évite le spinner/rechargement visible à chaque
// navigation quand rien n'a bougé (Stock, Accueil, Clients…).
export function useRechargementSiModifie(charger: () => void) {
  const derniereVersion = useRef<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (derniereVersion.current === null || versionDonnees() !== derniereVersion.current) {
        derniereVersion.current = versionDonnees();
        charger();
      }
    }, [charger])
  );
}