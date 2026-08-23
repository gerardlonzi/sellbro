import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader?.replace("Bearer ", ""));
  if (!user) return new Response(JSON.stringify({ erreur: "Non authentifié" }), { status: 401 });

  const { data: planData } = await supabaseAdmin.from("plan_utilisateur").select("plan_id").eq("user_id", user.id).single();
  const { data: plan } = await supabaseAdmin.from("plans").select("*").eq("id", planData?.plan_id ?? "gratuit").single();

  const debutMois = new Date();
  debutMois.setDate(1);
  const { count: scansUtilises } = await supabaseAdmin
    .from("ventes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("source", "scan")
    .gte("created_at", debutMois.toISOString());

  if ((scansUtilises ?? 0) >= plan.quota_scan) {
    return new Response(JSON.stringify({ erreur: "quota_epuise" }), { status: 403 });
  }

  const imageBlob = await req.blob();
  const buffer = await imageBlob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

  const reponse = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${Deno.env.get("GOOGLE_VISION_API_KEY")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{ image: { content: base64 }, features: [{ type: "TEXT_DETECTION" }] }],
    }),
  });

  if (!reponse.ok) {
    return new Response(JSON.stringify({ erreur: "echec_scan" }), { status: 502 });
  }

  const resultat = await reponse.json();
  const texte = resultat.responses?.[0]?.fullTextAnnotation?.text ?? "";
  return new Response(JSON.stringify({ texte }), { headers: { "Content-Type": "application/json" } });
});