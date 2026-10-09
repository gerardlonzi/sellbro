import { supabase } from "@/lib/supabase/client";
import { avecTimeout } from "@/lib/timeout";
import { ExtractedDocument, LigneScannee } from "./types";

// Audit des scans (§17-18) : chaque facture analysée est consignée dans
// document_scans / document_scan_items (Supabase, RLS par user_id), avec les
// correspondances retenues — y compris celles CORRIGÉES par l'utilisateur.
//
// C'est un audit EN LIGNE uniquement, best-effort : hors ligne ou en cas
// d'échec, on n'empêche JAMAIS l'enregistrement de l'opération métier (la
// vente/l'achat local prime, la synchronisation WatermelonDB fera le reste).

export type ResultatAudit = "ok" | "doublon" | "echec" | "hors_ligne";

// Clé d'idempotence (§19) : un même document ne doit pas être enregistré
// deux fois. Basée sur le numéro de facture quand l'IA l'a lu ; sinon null
// (pas de clé fiable → on laisse passer, l'utilisateur a validé).
export function cleIdempotence(userId: string, document: ExtractedDocument): string | null {
  if (!document.invoiceNumber) return null;
  return [userId, document.invoiceNumber, document.total ?? "", document.date ?? ""].join(":");
}

export async function enregistrerAuditScan(params: {
  userId: string;
  document: ExtractedDocument;
  lignes: LigneScannee[];
  statut: "validee" | "rejetee";
  // Résolution id local (WatermelonDB) → id distant (Supabase produits.id).
  remoteIdsParProduitId: Map<string, string>;
}): Promise<ResultatAudit> {
  const { userId, document, lignes, statut } = params;
  try {
    const confianceMoyenne = lignes.length
      ? lignes.reduce((s, l) => s + l.match.score, 0) / lignes.length
      : null;

    const { data: scan, error } = await avecTimeout(
      supabase
        .from("document_scans")
        .insert({
          user_id: userId,
          document_type: document.documentType,
          raw_extraction: document,
          status: statut,
          confidence: confianceMoyenne,
          idempotence_key: cleIdempotence(userId, document),
        })
        .select("id")
        .single(),
      8000
    );
    if (error) {
      // Violation d'unicité sur idempotence_key → même facture déjà enregistrée.
      if ((error as any).code === "23505") return "doublon";
      return "echec";
    }

    const items = lignes
      .filter((l) => !l.ignoree)
      .map((l) => ({
        document_scan_id: scan.id,
        raw_name: l.rawName,
        // La table référence l'id DISTANT du produit (pas l'id local).
        matched_product_id: l.produitIdChoisi ? (params.remoteIdsParProduitId.get(l.produitIdChoisi) ?? null) : null,
        quantity: l.quantity ?? null,
        unit: l.unit ?? null,
        unit_price: l.unitPrice ?? null,
        total_price: l.totalPrice ?? null,
        confidence: l.match.score,
        matching_method: l.match.method,
        // « Confirmé » = l'utilisateur a gardé ou corrigé la correspondance.
        user_confirmed: l.produitIdChoisi !== null,
      }));
    if (items.length > 0) {
      await avecTimeout(supabase.from("document_scan_items").insert(items), 8000);
    }
    return "ok";
  } catch {
    return "hors_ligne";
  }
}

// Vérifie AVANT l'enregistrement métier si cette facture a déjà été validée
// (anti-doublon §19). Renvoie false hors ligne (on ne bloque pas sans preuve).
export async function scanDejaEnregistre(userId: string, document: ExtractedDocument): Promise<boolean> {
  const cle = cleIdempotence(userId, document);
  if (!cle) return false;
  try {
    const { data } = await avecTimeout(
      supabase.from("document_scans").select("id").eq("idempotence_key", cle).eq("status", "validee").limit(1),
      5000
    );
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
