import { supabase } from "@/lib/supabase/client";
import { avecTimeout } from "@/lib/timeout";
import { ExtractedDocument } from "../types";
import { DocumentAIProvider, SpeechToTextProvider } from "./DocumentAIProvider";

// Fournisseur MVP : l'app appelle l'Edge Function Supabase, qui seule
// connaît la clé OpenAI (§14 — JAMAIS de clé API dans l'app mobile).
//
//   React Native → Edge Function « analyser-document » → OpenAI
//
// Renvoie null hors ligne / en cas d'échec : l'écran affiche alors le
// message « document illisible / réessayez », sans créer quoi que ce soit.
export class OpenAIEdgeProvider implements DocumentAIProvider {
  async analyzeDocument(input: {
    imageBase64: string;
    typeMime: string;
    contexte?: { candidatsProduits?: { id: string; nom: string }[] };
  }): Promise<ExtractedDocument | null> {
    try {
      const { data: { session } } = await avecTimeout(supabase.auth.getSession(), 5000);
      if (!session) return null;

      const { data, error } = await avecTimeout(
        supabase.functions.invoke("analyser-document", {
          body: {
            imageBase64: input.imageBase64,
            typeMime: input.typeMime,
            contexte: input.contexte ?? {},
          },
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        60000 // l'analyse vision peut prendre plusieurs dizaines de secondes
      );

      if (error || !data?.document) return null;
      return normaliserDocument(data.document);
    } catch {
      return null;
    }
  }
}

// Sécurise la sortie de l'IA : types stricts, tableaux toujours présents,
// montants numériques ou null — l'écran de validation ne doit jamais
// recevoir de valeur exotique.
function normaliserDocument(brut: any): ExtractedDocument {
  const typesValides = ["sale", "purchase", "expense", "payment", "unknown"];
  const nombreOuNull = (v: any) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const texteOuNull = (v: any) => (typeof v === "string" && v.trim() ? v.trim() : null);

  return {
    documentType: typesValides.includes(brut?.documentType) ? brut.documentType : "unknown",
    date: texteOuNull(brut?.date),
    invoiceNumber: texteOuNull(brut?.invoiceNumber),
    customerName: texteOuNull(brut?.customerName),
    supplierName: texteOuNull(brut?.supplierName),
    currency: texteOuNull(brut?.currency),
    subtotal: nombreOuNull(brut?.subtotal),
    tax: nombreOuNull(brut?.tax),
    discount: nombreOuNull(brut?.discount),
    total: nombreOuNull(brut?.total),
    paidAmount: nombreOuNull(brut?.paidAmount),
    remainingAmount: nombreOuNull(brut?.remainingAmount),
    items: Array.isArray(brut?.items)
      ? brut.items
          .filter((i: any) => typeof i?.rawName === "string" && i.rawName.trim())
          .map((i: any) => ({
            rawName: i.rawName.trim(),
            quantity: nombreOuNull(i.quantity),
            unit: texteOuNull(i.unit),
            unitPrice: nombreOuNull(i.unitPrice),
            totalPrice: nombreOuNull(i.totalPrice),
            sku: texteOuNull(i.sku),
            barcode: texteOuNull(i.barcode),
          }))
      : [],
    expenses: Array.isArray(brut?.expenses)
      ? brut.expenses
          .filter((e: any) => typeof e?.rawDescription === "string" && e.rawDescription.trim())
          .map((e: any) => ({
            rawDescription: e.rawDescription.trim(),
            category: texteOuNull(e.category),
            amount: nombreOuNull(e.amount),
          }))
      : [],
    notes: texteOuNull(brut?.notes),
  };
}

// Abstraction voix (§16) : encapsule l'existant transcrireAudio. Une future
// implémentation locale (Whisper on-device…) remplacera cette classe sans
// toucher aux appelants.
export class CloudSpeechProvider implements SpeechToTextProvider {
  async transcrire(input: { audioUri: string }): Promise<string | null> {
    const { transcrireAudio } = await import("@/lib/ai/voice");
    return transcrireAudio(input.audioUri);
  }
}
