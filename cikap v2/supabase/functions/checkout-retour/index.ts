// Edge Function : pont HTTPS → deep link pour le retour du checkout SasPay.
//
// SasPay exige une return_url en https:// — un deep link cikap:// est refusé
// (« Saisissez une URL valide »). Cette fonction sert donc de return_url :
// elle renvoie une redirection 302 vers le deep link de l'app, ce qui ferme
// le navigateur ouvert par openAuthSessionAsync et ramène l'utilisateur dans
// l'app (route app/premium/retour.tsx).
//
// Ce n'est PAS une preuve de paiement : seul le webhook saspay-webhook
// confirme. Les query params ajoutés par SasPay (session id, statut…) sont
// relayés au deep link à titre informatif uniquement.
//
// Déploiement : supabase functions deploy checkout-retour
// (config.toml : verify_jwt = false — appelée par le navigateur, sans JWT)
const DEEP_LINK_BASE = "cikap://premium/retour";

Deno.serve((req) => {
  const url = new URL(req.url);
  const cible = DEEP_LINK_BASE + url.search; // relaie ?session_id=... etc.
  return new Response(null, {
    status: 302,
    headers: { Location: cible },
  });
});
