import { useEffect } from "react";
import { AppState } from "react-native";
import { useConnexion } from "@/lib/useConnexion";
import { synchroniserTout } from "@/lib/database/sync";
import { obtenirUserId } from "@/lib/auth/userCache";

// Synchronise automatiquement :
//  - au démarrage (si déjà connecté) ;
//  - à CHAQUE retour de connexion (le travail fait hors ligne est poussé) ;
//  - à chaque retour de l'app au premier plan (données modifiées ailleurs).
// L'id utilisateur est lu localement : aucun appel réseau bloquant avant la synchro.
export function useSynchronisation() {
  const enLigne = useConnexion();

  useEffect(() => {
    if (!enLigne) return;
    let actif = true;

    const lancer = async () => {
      try {
        const userId = await obtenirUserId();
        if (userId && actif) await synchroniserTout(userId);
      } catch {
        // La prochaine connexion / ouverture relancera la synchro.
      }
    };

    lancer();
    const abonnement = AppState.addEventListener("change", (etat) => {
      if (etat === "active") lancer();
    });
    return () => {
      actif = false;
      abonnement.remove();
    };
  }, [enLigne]);
}
