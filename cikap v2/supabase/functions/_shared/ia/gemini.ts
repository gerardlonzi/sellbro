// Google Gemini (API Generative Language) — secret GEMINI_API_KEY.
import { EntreeAudio, EntreeImage, ErreurFournisseur, FournisseurIA, detailCle, fetchAvecDelai } from "./types.ts";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

async function generer(modele: string, cle: string, corps: unknown, delaiMs: number): Promise<string> {
  const appeler = (c: unknown) => fetchAvecDelai("gemini", `${BASE}/${encodeURIComponent(modele)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": cle, "Content-Type": "application/json" },
    body: JSON.stringify(c),
  }, delaiMs);
  let r = await appeler(corps);
  if (!r.ok) {
    const detail = await r.text();
    // Le réglage de « réflexion » (thinkingConfig) diffère selon les versions du
    // modèle : s'il est refusé (400), on réessaie UNE fois sans lui plutôt que de
    // faire échouer tout l'appel.
    const c: any = corps;
    if (r.status === 400 && /think/i.test(detail) && c?.generationConfig?.thinkingConfig) {
      const { thinkingConfig: _t, ...gc } = c.generationConfig;
      r = await appeler({ ...c, generationConfig: gc });
      if (!r.ok) throw new ErreurFournisseur("gemini", r.status, (await r.text()).slice(0, 300));
    } else {
      throw new ErreurFournisseur("gemini", r.status, detail.slice(0, 300));
    }
  }
  const json = await r.json();
  const parties = json?.candidates?.[0]?.content?.parts;
  const texte = Array.isArray(parties) ? parties.map((p: any) => p?.text ?? "").join("") : "";
  if (!texte) {
    const raison = json?.promptFeedback?.blockReason ?? json?.candidates?.[0]?.finishReason ?? "réponse vide";
    throw new ErreurFournisseur("gemini", null, String(raison));
  }
  return texte;
}

export const gemini: FournisseurIA = {
  id: "gemini",
  secretEnv: "GEMINI_API_KEY",
  modeleVisionDefaut: "gemini-3.8-flash",
  modeleAudioDefaut: "gemini-3.8-flash",

  analyserImage(e: EntreeImage, cle, modele, delaiMs) {
    return generer(modele, cle, {
      systemInstruction: { parts: [{ text: e.systeme }] },
      contents: [{ role: "user", parts: [
        { text: `${e.consigne}\n\nRéponds UNIQUEMENT avec un objet JSON valide respectant ce schéma :\n${JSON.stringify(e.schema)}` },
        { inline_data: { mime_type: e.typeMime, data: e.imageBase64 } },
      ] }],
      generationConfig: {  responseMimeType: "application/json", thinkingConfig: { thinkingLevel: "low" } },
    }, delaiMs);
  },

  async transcrire(e: EntreeAudio, cle, modele, delaiMs) {
    // Gemini lit le m4a/AAC sous le type audio/mp4.
    const mime = e.typeMime === "audio/m4a" || e.typeMime === "audio/x-m4a" ? "audio/mp4" : e.typeMime;
    let binaire = "";
    for (let i = 0; i < e.octets.length; i += 0x8000) binaire += String.fromCharCode(...e.octets.subarray(i, i + 0x8000));
    const langue = e.langue === "en" ? "l'anglais" : "le français";
    const texte = await generer(modele, cle, {
      contents: [{ role: "user", parts: [
        { text: `Transcris fidèlement cet enregistrement : un commerçant dicte une vente en ${langue} (produits, quantités, prix, nom du client). Réponds UNIQUEMENT avec la transcription, sans commentaire. S'il n'y a aucune parole, réponds avec une chaîne vide.` },
        { inline_data: { mime_type: mime, data: btoa(binaire) } },
      ] }],
      generationConfig: { thinkingConfig: { thinkingLevel: "low" }},
    }, delaiMs);
    return texte.trim();
  },

  async verifierCle(cle) {
    const r = await fetch(`${BASE}?pageSize=1`, { headers: { "x-goog-api-key": cle } });
    return { ok: r.ok, detail: r.ok ? "Clé valide" : detailCle(r.status) };
  },
};
