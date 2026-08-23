import { useEffect, useRef } from "react";
import { useConnexion } from "@/lib/useConnexion";
import { synchroniserTout } from "@/lib/database/sync";
import { supabase } from "@/lib/supabase/client";

export function useSynchronisation() {
  const enLigne = useConnexion();
  const etaitHorsLigne = useRef(true);

  useEffect(() => {
    if (!enLigne) {
      etaitHorsLigne.current = true;
      return;
    }
    if (etaitHorsLigne.current) {
      etaitHorsLigne.current = false;
      lancerSync();
    }
  }, [enLigne]);

  async function lancerSync() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) synchroniserTout(user.id);
  }
}