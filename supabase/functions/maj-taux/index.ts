// Edge Function : actualise les taux de change depuis l'API (open.er-api.com).
// Appelable par l'app (utilisateur connecté : au plus 1 appel d'API par heure,
// géré dans _shared/taux.ts), par un cron, ou à la main avec {"forcer":true}
// (réservé à la clé service_role).
//
// Déploiement : supabase functions deploy maj-taux
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS, json } from "../_shared/pays.ts";
import { obtenirTaux } from "../_shared/taux.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "non authentifié", code: "non_authentifie" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const estService = authHeader === `Bearer ${service}`;
    if (!estService) {
      const c = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await c.auth.getUser();
      if (!user) return json({ error: "session invalide", code: "session_invalide" }, 401);
    }
    const corps = await req.json().catch(() => ({}));
    const admin = createClient(url, service);
    const taux = await obtenirTaux(admin, estService && corps?.forcer === true);
    return json({ taux, nombre: Object.keys(taux).length });
  } catch (e) {
    return json({ error: String(e), code: "erreur_interne" }, 500);
  }
});
