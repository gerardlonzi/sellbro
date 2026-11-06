// xAI Grok (API compatible OpenAI) — secret XAI_API_KEY. Vision uniquement :
// pas de transcription audio branchée (à ajouter si xAI en propose une pour ton compte).
import { EntreeImage, ErreurFournisseur, FournisseurIA, detailCle, fetchAvecDelai } from "./types.ts";

export const grok: FournisseurIA = {
  id: "grok",
  secretEnv: "XAI_API_KEY",
  modeleVisionDefaut: "grok-4",

  async analyserImage(e: EntreeImage, cle, modele, delaiMs) {
    const r = await fetchAvecDelai("grok", "https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modele,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: e.systeme },
          { role: "user", content: [
            { type: "text", text: `${e.consigne}\n\nRéponds UNIQUEMENT avec un objet JSON valide respectant ce schéma :\n${JSON.stringify(e.schema)}` },
            { type: "image_url", image_url: { url: `data:${e.typeMime};base64,${e.imageBase64}`, detail: "high" } },
          ] },
        ],
      }),
    }, delaiMs);
    if (!r.ok) throw new ErreurFournisseur("grok", r.status, (await r.text()).slice(0, 300));
    const texte = (await r.json())?.choices?.[0]?.message?.content;
    if (typeof texte !== "string") throw new ErreurFournisseur("grok", null, "réponse vide");
    return texte;
  },

  async verifierCle(cle) {
    const r = await fetch("https://api.x.ai/v1/models", { headers: { Authorization: `Bearer ${cle}` } });
    return { ok: r.ok, detail: r.ok ? "Clé valide" : detailCle(r.status) };
  },
};
