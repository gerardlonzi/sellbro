import { useEffect } from "react";
import { useConnexion } from "@/lib/useConnexion";
import { synchroniserTout } from "@/lib/database/sync";
import { supabase } from "@/lib/supabase/client";
import { avecTimeout } from "@/lib/timeout";

// Synchronise automatiquement dès que l'app est en ligne :
// au démarrage (si déjà connecté) et à chaque retour de connexion.
export function useSynchronisation() {
  const enLigne = useConnexion();

  useEffect(() => {
    if (!enLigne) return;

    let actif = true;
    (async () => {
      try {
        // Timeout : hors ligne (ou réseau instable), getUser peut rester pendu.
        const {
          data: { user },
        } = await avecTimeout(supabase.auth.getUser(), 5000);
        if (user && actif) await synchroniserTout(user.id);
      } catch {
        // Hors ligne : la prochaine connexion réseau relancera la sync.
      }
    })();

    return () => {
      actif = false;
    };
  }, [enLigne]);
}