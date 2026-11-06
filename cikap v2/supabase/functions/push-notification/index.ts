// Edge Function Supabase : notification push INSTANTANÉE via Expo Push.
//
// Déploiement :
//   supabase functions deploy push-notification
//
// Puis dans le Dashboard Supabase → Database → Webhooks → Create :
//   - Table : notifications
//   - Events : INSERT
//   - Type : Supabase Edge Function → push-notification
//
// À chaque alerte insérée (rupture, stock faible, créance en retard), le
// destinataire reçoit une notification push immédiatement, même app fermée.
// Le message est traduit selon profiles.langue.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type EnregistrementNotif = {
  user_id: string;
  type: string;
  message: string; // nom du produit / du client (stocké sans traduction)
};

const TEXTES: Record<string, { fr: [string, string]; en: [string, string] }> = {
  rupture_stock: {
    fr: ["Rupture de stock", "{nom} est en rupture de stock"],
    en: ["Out of stock", "{nom} is out of stock"],
  },
  stock_faible: {
    fr: ["Stock faible", "{nom} est presque épuisé"],
    en: ["Low stock", "{nom} is running low"],
  },
  creance_retard: {
    fr: ["Créance en retard", "{nom} a une créance en retard de paiement"],
    en: ["Overdue credit", "{nom} has an overdue payment"],
  },
};

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record as EnregistrementNotif | undefined;
    if (!record?.user_id) return new Response("ignoré", { status: 200 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profil } = await supabase
      .from("profiles")
      .select("expo_push_token, langue")
      .eq("id", record.user_id)
      .single();

    if (!profil?.expo_push_token) return new Response("pas de token", { status: 200 });

    const textes = TEXTES[record.type] ?? {
      fr: ["Cikap", "{nom}"],
      en: ["Cikap", "{nom}"],
    };
    const [titre, corps] = profil.langue === "en" ? textes.en : textes.fr;

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: profil.expo_push_token,
        title: titre,
        body: corps.replace("{nom}", record.message),
        sound: "default",
        data: { ecran: "/notifications" },
      }),
    });

    return new Response("envoyé", { status: 200 });
  } catch (e) {
    return new Response(`erreur: ${e}`, { status: 500 });
  }
});
