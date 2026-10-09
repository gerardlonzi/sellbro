// Types du scanner intelligent de documents.
// L'IA renvoie UNIQUEMENT ces données structurées — elle n'écrit jamais
// dans la base : la création passe par les services métier (creerVente,
// creerAchat, creerDepense) après VALIDATION par l'utilisateur.

export type DocumentType = "sale" | "purchase" | "expense" | "payment" | "unknown";

export interface ExtractedItem {
  rawName: string;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  totalPrice?: number | null;
  sku?: string | null;
  barcode?: string | null;
}

export interface ExtractedExpense {
  rawDescription: string;
  category?: string | null;
  amount?: number | null;
}

export interface ExtractedDocument {
  documentType: DocumentType;
  date?: string | null;
  invoiceNumber?: string | null;
  customerName?: string | null;
  supplierName?: string | null;
  currency?: string | null;
  subtotal?: number | null;
  tax?: number | null;
  discount?: number | null;
  total?: number | null;
  paidAmount?: number | null;
  remainingAmount?: number | null;
  items: ExtractedItem[];
  expenses: ExtractedExpense[];
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Matching produit
// ---------------------------------------------------------------------------

export type MatchingMethod = "exact" | "barcode" | "alias" | "normalized" | "fuzzy" | "context" | "none";

export interface ProductMatch {
  productId: string | null; // null si aucun candidat suffisant
  rawName: string;
  matchedName: string | null;
  score: number; // 0 → 1
  method: MatchingMethod;
  // Candidats alternatifs présentés à l'utilisateur en cas de doute.
  candidats: { productId: string; nom: string; score: number }[];
}

// Une ligne de la facture après matching : c'est CE modèle que l'écran de
// validation affiche et que l'utilisateur corrige.
export interface LigneScannee extends ExtractedItem {
  match: ProductMatch;
  // Choix final de l'utilisateur (initialisé depuis le match si confiance
  // suffisante, sinon null = « produit non reconnu »).
  produitIdChoisi: string | null;
  ignoree: boolean;
}

// Alias appris : « RUI » → product_id (isolé par user_id, jamais partagé
// entre commerçants).
export interface AliasProduit {
  id: string;
  userId: string;
  produitId: string;
  alias: string;
  aliasNormalise: string;
  source: "user_confirmed" | "ai_suggested" | "imported" | "manual";
  confiance: number | null;
}
