import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const secretRecu = req.headers.get("X-Webhook-Secret");
  if (secretRecu !== Deno.env.get("WEBHOOK_PAIEMENT_SECRET")) {
    return new Response(JSON.stringify({ erreur: "Non autorisé" }), { status: 401 });
  }

  const { email, plan_id, montant_paye, moyen_paiement, reference_transaction } = await req.json();

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: profil } = await supabaseAdmin.from("profiles").select("id").eq("email", email).single();
  if (!profil) return new Response(JSON.stringify({ erreur: "Utilisateur introuvable" }), { status: 404 });

  const dateExpiration = new Date();
  dateExpiration.setMonth(dateExpiration.getMonth() + 1);

  await supabaseAdmin.from("abonnements").insert({
    user_id: profil.id,
    plan_id,
    statut: "actif",
    date_expiration: dateExpiration.toISOString(),
    montant_paye,
    moyen_paiement,
    reference_transaction,
  });

  return new Response(JSON.stringify({ succes: true }), { headers: { "Content-Type": "application/json" } });
});