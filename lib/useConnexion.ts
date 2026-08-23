import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

// Utilisé partout où on doit désactiver Vocal/Scan et afficher
// "Connexion internet requise" — jamais bloquer le reste de l'app.
export function useConnexion() {
  const [enLigne, setEnLigne] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setEnLigne(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsubscribe();
  }, []);

  return enLigne;
}
