import { EntreeAudio, EntreeImage, ErreurFournisseur, FournisseurIA, detailCle, fetchAvecDelai } from "./types.ts";

export const openai: FournisseurIA = {
  id: "openai",
  secretEnv: "OPENAI_API_KEY",
  modeleVisionDefaut: "gpt-4o-mini",
  modeleAudioDefaut: "gpt-4o-mini-transcribe",

  async analyserImage(e: EntreeImage, cle, modele, delaiMs) {
    const r = await fetchAvecDelai("openai", "https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modele,
        temperature: 0,
        response_format: { type: "json_schema", json_schema: { name: "document_commercial", schema: e.schema, strict: false } },
        messages: [
          { role: "system", content: e.systeme },
          { role: "user", content: [
            { type: "text", text: e.consigne },
            { type: "image_url", image_url: { url: `data:${e.typeMime};base64,${e.imageBase64}` } },
          ] },
        ],
      }),
    }, delaiMs);
    if (!r.ok) throw new ErreurFournisseur("openai", r.status, (await r.text()).slice(0, 300));
    const texte = (await r.json())?.choices?.[0]?.message?.content;
    if (typeof texte !== "string") throw new ErreurFournisseur("openai", null, "réponse vide");
    return texte;
  },

  async transcrire(e: EntreeAudio, cle, modele, delaiMs) {
    const fd = new FormData();
    fd.append("file", new Blob([e.octets as unknown as BlobPart], { type: e.typeMime }), `audio.${e.extension}`);
    fd.append("model", modele);
    if (e.langue) fd.append("language", e.langue);
    const r = await fetchAvecDelai("openai", "https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: `Bearer ${cle}` }, body: fd,
    }, delaiMs);
    if (!r.ok) throw new ErreurFournisseur("openai", r.status, (await r.text()).slice(0, 300));
    const texte = (await r.json())?.text;
    return typeof texte === "string" ? texte.trim() : "";
  },

  async verifierCle(cle) {
    const r = await fetch("https://api.openai.com/v1/models/gpt-4o-mini", { headers: { Authorization: `Bearer ${cle}` } });
    return { ok: r.ok, detail: r.ok ? "Clé valide" : detailCle(r.status) };
  },
};
