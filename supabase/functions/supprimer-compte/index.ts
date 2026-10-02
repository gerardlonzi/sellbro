// Edge Function : suppression totale d'un compte à la demande de l'utilisateur.
// Appelée depuis l'écran « Mon compte » de l'app, après double confirmation.
//
// Elle supprime l'identité auth (`auth.users`), ce qui entraîne en cascade le
// profil (`profiles` référence auth.users avec ON DELETE CASCADE) puis toutes
// les données métier (chaque table référence profiles.id avec ON DELETE
// CASCADE). Elle efface aussi les images de l'utilisateur dans Storage, qui ne
// participent pas à la cascade SQL.
//
// Déploiement : supabase functions deploy supprimer-compte
// Aucun secret à ajouter : SUPABASE_URL / SUPABASE_ANON_KEY /
// SUPABASE_SERVICE_ROLE_KEY sont fournis par défaut aux Edge Functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "méthode non autorisée" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "non authentifié" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // 1) Identifie l'appelant avec SON jeton : on ne peut supprimer que soi.
    const clientUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: errAuth } = await clientUser.auth.getUser();
    if (errAuth || !user) return json({ error: "session invalide" }, 401);

    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 2) Efface les images de l'utilisateur (bucket images-boutika), dossier
    //    produits/ et logos/ préfixés par son id. Les erreurs ici n'empêchent
    //    pas la suppression du compte : un dossier vide ou absent n'est pas bloquant.
    for (const dossier of ["produits", "logos"]) {
      const prefixe = `${dossier}/${user.id}`;
      try {
        const { data: fichiers } = await supabaseAdmin.storage.from("images-boutika").list(prefixe, { limit: 1000 });
        if (fichiers && fichiers.length > 0) {
          const chemins = fichiers.map((f) => `${prefixe}/${f.name}`);
          await supabaseAdmin.storage.from("images-boutika").remove(chemins);
        }
      } catch (e) {
        console.error(`suppression storage ${prefixe}:`, e);
      }
    }

    // 3) Supprime l'identité : tout le reste part en cascade.
    const { error: errSuppression } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (errSuppression) return json({ error: errSuppression.message }, 500);

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: "erreur interne" }, 500);
  }
});
