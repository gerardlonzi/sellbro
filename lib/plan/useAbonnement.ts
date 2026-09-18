import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import { avecTimeout } from "@/lib/timeout";

const CLE_ABONNEMENT = "abonnement_cache";

// Jours restants avant expiration, calculés depuis la date d'expiration
// (l'abonnement est mensuel : date_expiration = date de paiement + 1 mois).
function joursRestantsDepuis(dateExpiration: string | null): number {
  if (!dateExpiration) return 0;
  return Math.max(0, Math.ceil((new Date(dateExpiration).getTime() - Date.now()) / 86400000));
}

export function useAbonnement() {
  const [dateExpiration, setDateExpiration] = useState<string | null>(null);
  const [expire, setExpire] = useState(false);

  useEffect(() => {
    charger();
  }, []);

  async function charger() {
    // 1) Cache local d'abord : l'affichage fonctionne hors ligne.
    try {
      const brut = await AsyncStorage.getItem(CLE_ABONNEMENT);
      if (brut) {
        const cache = JSON.parse(brut) as { date_expiration: string | null; expire: boolean };
        if (cache.date_expiration) {
          setDateExpiration(cache.date_expiration);
          setExpire(new Date(cache.date_expiration) < new Date() || cache.expire);
        }
      }
    } catch {}

    // 2) Rafraîchissement serveur en arrière-plan (ignoré hors ligne).
    try {
      // Timeout : hors ligne, getUser peut rester pendu (refresh du token).
      const { data: { user } } = await avecTimeout(supabase.auth.getUser(), 5000);
      if (!user) return;
      const { data } = await avecTimeout(supabase
        .from("abonnements")
        .select("date_expiration, statut")
        .eq("user_id", user.id)
        .order("date_debut", { ascending: false })
        .limit(1)
        .maybeSingle(), 5000);
      if (data?.date_expiration) {
        const estExpire = new Date(data.date_expiration) < new Date() || data.statut === "expire";
        setDateExpiration(data.date_expiration);
        setExpire(estExpire);
        await AsyncStorage.setItem(
          CLE_ABONNEMENT,
          JSON.stringify({ date_expiration: data.date_expiration, expire: data.statut === "expire" })
        );
      }
    } catch {
      // Hors ligne : on garde le cache.
    }
  }

  return { dateExpiration, expire, joursRestants: joursRestantsDepuis(dateExpiration), recharger: charger };
}
