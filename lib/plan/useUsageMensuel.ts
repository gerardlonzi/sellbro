import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export function useUsageMensuel() {
  const [vocauxUtilises, setVocauxUtilises] = useState(0);
  const [scansUtilises, setScansUtilises] = useState(0);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    charger();
  }, []);

  async function charger() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setPret(true);
      return;
    }

    const debutMois = new Date();
    debutMois.setDate(1);
    debutMois.setHours(0, 0, 0, 0);

    const [vocal, scan] = await Promise.all([
      supabase.from("ventes").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("source", "vocal").gte("created_at", debutMois.toISOString()),
      supabase.from("ventes").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("source", "scan").gte("created_at", debutMois.toISOString()),
    ]);

    setVocauxUtilises(vocal.count ?? 0);
    setScansUtilises(scan.count ?? 0);
    setPret(true);
  }

  return { vocauxUtilises, scansUtilises, pret, recharger: charger };
}