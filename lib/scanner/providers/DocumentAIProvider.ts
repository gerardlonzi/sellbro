import { ExtractedDocument } from "../types";

// Abstraction du fournisseur d'analyse de documents (§14-15) : l'application
// ne dépend JAMAIS d'OpenAI directement. Pour ajouter un fournisseur local
// (OCR on-device, LLM local…), on crée une nouvelle implémentation sans
// toucher au reste de Cikap.
export interface DocumentAIProvider {
  analyzeDocument(input: {
    imageBase64: string;
    typeMime: string;
    // Contexte métier optionnel : candidats produits présélectionnés
    // localement (on n'envoie JAMAIS toute la base à l'IA — §20).
    contexte?: { candidatsProduits?: { id: string; nom: string }[] };
  }): Promise<ExtractedDocument | null>;
}

export interface SpeechToTextProvider {
  transcrire(input: { audioUri: string }): Promise<string | null>;
}
