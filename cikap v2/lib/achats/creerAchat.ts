import { database } from "@/lib/database";
import { enregistrerMouvementStock } from "@/lib/stock/mouvements";
import { synchroniserPourUtilisateurCourant } from "@/lib/database/sync";
import { enregistrerActivite } from "@/lib/audit/journal";

// Service métier UNIQUE de création d'achat : utilisé par l'écran « Nouvel
// achat » ET par le scanner de factures. Crée l'achat, la dette si achat à
// crédit, et augmente le stock si un produit du catalogue est concerné.
export async function creerAchat(params: {
  userId: string;
  fournisseurNom?: string;
  fournisseurTelephone?: string | null;
  description?: string;
  montant: number;
  aCredit?: boolean;
  dateEcheance?: string | null;
  produitId?: string | null;
  produitNom?: string | null;
  quantiteRecue?: number | null;
  // Facture multi-produits (scanner) : une ligne par produit reçu. Le stock
  // est augmenté pour CHAQUE ligne ; `montant` reste le total de la facture.
  // Si `lignes` est fourni, il prime sur produitId/quantiteRecue.
  lignes?: { produitId: string; produitNom: string; quantite: number }[];
  source?: string; // « manuel », « scan_facture »…
  // Date de la pièce (scanner : date lue sur la facture). Défaut : maintenant.
  date?: Date;
  // Achat à crédit PARTIELLEMENT payé : la dette ne porte que sur le reste dû.
  montantRestantDette?: number | null;
}): Promise<void> {
  const { userId } = params;
  const dateOperation = params.date ?? new Date();
  const fournisseur = params.fournisseurNom?.trim() ?? "";
  const description = params.description?.trim() ?? "";

  await database.write(async () => {
    await database.get("achats").create((a: any) => {
      a.userId = userId;
      a.fournisseurNom = fournisseur || null;
      a.description = description || null;
      a.montant = params.montant;
      a.source = params.source ?? "manuel";
      a.donneesSupplementairesJson = "{}";
      a.creeLe = dateOperation;
      a.synchronise = false;
    });

    // Achat à crédit → on crée la DETTE correspondante (visible dans
    // Créances & dettes, côté « Tu dois »).
    if (params.aCredit) {
      // Paiement partiel : la dette ne porte que sur le reste dû.
      const restant = params.montantRestantDette != null && params.montantRestantDette >= 0
        ? Math.min(params.montantRestantDette, params.montant)
        : params.montant;
      if (restant > 0) {
        await database.get("creances_dettes").create((c: any) => {
          c.userId = userId;
          c.type = "dette";
          c.personneNom = fournisseur;
          c.telephone = params.fournisseurTelephone ?? null;
          c.montantInitial = restant;
          c.montantRestant = restant;
          c.dateEcheance = params.dateEcheance ?? null;
          c.statut = "en_cours";
          c.note = description || null;
          c.produitConcerne = params.produitNom ?? null;
          c.creeLe = dateOperation;
          c.synchronise = false;
        });
      }
    }
  });

  // Si l'achat est lié à un ou plusieurs produits du stock, on augmente le
  // stock automatiquement (une ligne par produit reçu).
  const lignesStock = params.lignes?.length
    ? params.lignes.map((l) => ({ produitId: l.produitId, quantite: l.quantite }))
    : params.produitId && params.quantiteRecue
      ? [{ produitId: params.produitId, quantite: params.quantiteRecue }]
      : [];
  for (const ligne of lignesStock) {
    await enregistrerMouvementStock({
      userId: userId,
      produitId: ligne.produitId,
      type: "achat",
      quantite: ligne.quantite,
      raison: fournisseur ? `Réassort — ${fournisseur}` : "Réassort",
    });
  }

  synchroniserPourUtilisateurCourant().catch(() => {});
  const libelleAchat = params.lignes?.length
    ? `Achat enregistré : ${params.lignes.map((l) => `${l.quantite} × ${l.produitNom}`).join(", ")}`
    : params.quantiteRecue && params.produitNom
      ? `Achat enregistré : ${params.quantiteRecue} × ${params.produitNom}`
      : `Achat enregistré : ${description || fournisseur || "—"}`;
  await enregistrerActivite("achat", "ajout", libelleAchat);
}
