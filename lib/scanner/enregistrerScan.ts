import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { creerVente } from "@/lib/ventes/creerVente";
import { creerAchat } from "@/lib/achats/creerAchat";
import { creerDepense } from "@/lib/depenses/creerDepense";
import { enregistrerAlias } from "./aliases";
import { enregistrerAuditScan, scanDejaEnregistre } from "./audit";
import { devinerCategorieDepense } from "./categories";
import { Langue } from "@/lib/i18n";
import { DocumentType, ExtractedDocument, LigneScannee } from "./types";

// Orchestration UNIQUE de l'enregistrement d'un document scanné (§2, §11-12) :
// l'IA n'a fait que comprendre le document ; C'EST ICI — et uniquement ici,
// APRÈS validation par l'utilisateur — que les services métier de Cikap
// créent l'opération (vente / achat / dépense). Jamais de logique parallèle.

export type ChoixEnregistrement = {
  userId: string;
  document: ExtractedDocument;
  // Type finalement choisi par l'utilisateur (peut différer de l'IA).
  typeChoisi: DocumentType;
  lignes: LigneScannee[];
  date: Date;
  clientNom?: string;
  fournisseurNom?: string;
  langue: Langue;
};

export type ResultatEnregistrement = "ok" | "doublon" | "rien_a_enregistrer";

// Ids distants des produits (pour l'audit Supabase, qui référence produits.id).
async function remoteIdsParProduitId(userId: string): Promise<Map<string, string>> {
  const produits = (await database.get("produits").query(Q.where("user_id", userId)).fetch()) as any[];
  const map = new Map<string, string>();
  for (const p of produits) if (p.remoteId) map.set(p.id, p.remoteId);
  return map;
}

// Mémorise les correspondances confirmées par l'utilisateur (§7) : la
// prochaine facture avec le même libellé retrouvera le produit toute seule.
async function apprendreAlias(userId: string, lignes: LigneScannee[]): Promise<void> {
  for (const l of lignes) {
    if (l.ignoree || !l.produitIdChoisi || !l.rawName.trim()) continue;
    // L'alias est « user_confirmed » dès que l'utilisateur a validé la ligne
    // (correspondance gardée telle quelle OU corrigée : dans les deux cas il
    // a confirmé que « rawName » désigne ce produit).
    await enregistrerAlias({
      userId,
      produitId: l.produitIdChoisi,
      alias: l.rawName,
      source: "user_confirmed",
      confiance: l.match.score,
    });
  }
}

export async function enregistrerScan(choix: ChoixEnregistrement): Promise<ResultatEnregistrement> {
  const { userId, document, typeChoisi, langue } = choix;
  const lignesActives = choix.lignes.filter((l) => !l.ignoree);

  // Anti-doublon (§19) : la même facture ne doit jamais créer deux opérations.
  if (await scanDejaEnregistre(userId, document)) return "doublon";

  const restant = document.remainingAmount ?? null;
  const aCredit = restant != null && restant > 0;

  if (typeChoisi === "sale") {
    if (lignesActives.length === 0) return "rien_a_enregistrer";
    await creerVente({
      userId,
      lignes: lignesActives.map((l) => ({
        produitId: l.produitIdChoisi,
        nom: l.match.matchedName && l.produitIdChoisi ? l.match.matchedName : l.rawName,
        quantite: l.quantity ?? 1,
        prixUnitaire: l.unitPrice ?? (l.totalPrice != null && l.quantity ? l.totalPrice / l.quantity : l.totalPrice ?? 0),
      })),
      clientNom: choix.clientNom ?? document.customerName ?? undefined,
      modePaiement: aCredit ? "credit" : "cash",
      montantRestantCredit: aCredit ? restant : null,
      date: choix.date,
      source: "scan_facture",
    });
  } else if (typeChoisi === "purchase") {
    const lignesStock = lignesActives
      .filter((l) => l.produitIdChoisi)
      .map((l) => ({
        produitId: l.produitIdChoisi!,
        produitNom: l.match.matchedName ?? l.rawName,
        quantite: l.quantity ?? 1,
      }));
    // Total de la facture : celui lu par l'IA, sinon somme des lignes.
    const montant =
      document.total ??
      lignesActives.reduce((s, l) => s + (l.totalPrice ?? (l.unitPrice ?? 0) * (l.quantity ?? 1)), 0);
    if (montant <= 0 && lignesStock.length === 0) return "rien_a_enregistrer";
    await creerAchat({
      userId,
      fournisseurNom: choix.fournisseurNom ?? document.supplierName ?? undefined,
      montant,
      aCredit,
      montantRestantDette: aCredit ? restant : null,
      lignes: lignesStock.length > 0 ? lignesStock : undefined,
      description: document.invoiceNumber ? `Facture ${document.invoiceNumber}` : undefined,
      date: choix.date,
      source: "scan_facture",
    });
  } else if (typeChoisi === "expense") {
    // Une dépense par ligne de charge lue ; à défaut, une dépense au total.
    const depenses = document.expenses.length > 0
      ? document.expenses
      : document.total != null
        ? [{ rawDescription: document.notes ?? "Facture", category: null, amount: document.total }]
        : [];
    if (depenses.length === 0) return "rien_a_enregistrer";
    for (const dep of depenses) {
      if (dep.amount == null || dep.amount <= 0) continue;
      // §10 : on réutilise les catégories EXISTANTES, jamais de création auto.
      const categorie = devinerCategorieDepense(dep.category ?? dep.rawDescription, langue) ?? "autre";
      await creerDepense({
        userId,
        categorie,
        description: dep.rawDescription,
        montant: dep.amount,
        date: choix.date,
        descriptionAudit: `Dépense scannée : ${dep.rawDescription}`,
      });
    }
  } else {
    // payment / unknown : rien à créer automatiquement.
    return "rien_a_enregistrer";
  }

  // Apprentissage + audit : best-effort, n'empêchent JAMAIS l'enregistrement.
  await apprendreAlias(userId, lignesActives).catch(() => {});
  await enregistrerAuditScan({
    userId,
    document,
    lignes: choix.lignes,
    statut: "validee",
    remoteIdsParProduitId: await remoteIdsParProduitId(userId).catch(() => new Map()),
  }).catch(() => {});

  return "ok";
}

// L'utilisateur annule : on consigne le rejet (audit §18) sans rien créer.
export async function rejeterScan(userId: string, document: ExtractedDocument, lignes: LigneScannee[]): Promise<void> {
  await enregistrerAuditScan({
    userId,
    document,
    lignes,
    statut: "rejetee",
    remoteIdsParProduitId: await remoteIdsParProduitId(userId).catch(() => new Map()),
  }).catch(() => {});
}
