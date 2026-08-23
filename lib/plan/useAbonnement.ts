import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export function useAbonnement() {
  const [dateExpiration, setDateExpiration] = useState<string | null>(null);
  const [expire, setExpire] = useState(false);

  useEffect(() => {
    charger();
  }, []);

  async function charger() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("abonnements")
      .select("date_expiration, statut")
      .eq("user_id", user.id)
      .order("date_debut", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.date_expiration) {
      setDateExpiration(data.date_expiration);
      setExpire(new Date(data.date_expiration) < new Date() || data.statut === "expire");
    }
  }

  return { dateExpiration, expire, recharger: charger };
}