import { useEffect } from "react";
import { useConnexion } from "@/lib/useConnexion";
import { synchroniserTout } from "@/lib/database/sync";
import { supabase } from "@/lib/supabase/client";

// Synchronise automatiquement dès que l'app est en ligne :
// au démarrage (si déjà connecté) et à chaque retour de connexion.
export function useSynchronisation() {
  const enLigne = useConnexion();

  useEffect(() => {
    if (!enLigne) return;

    let actif = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && actif) await synchroniserTout(user.id);
    })();

    return () => {
      actif = false;
    };
  }, [enLigne]);
}