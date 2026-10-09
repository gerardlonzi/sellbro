import { database } from "@/lib/database";
import { enregistrerMouvementStock } from "@/lib/stock/mouvements";
import { synchroniserPourUtilisateurCourant } from "@/lib/database/sync";
import { enregistrerActivite } from "@/lib/audit/journal";

// Service métier UNIQUE de création de vente : utilisé par l'écran
// « Nouvelle vente » ET par le scanner de factures — jamais de logique
// parallèle. Crée les lignes de vente (regroupées par transactionId), la
// créance si paiement à crédit, et déduit le stock.
export async function creerVente(params: {
  userId: string;
  lignes: { produitId: string | null; nom: string; quantite: number; prixUnitaire: number }[];
  clientNom?: string;
  clientTelephone?: string | null; // déjà formaté avec l'indicatif pays
  modePaiement: "cash" | "momo" | "credit";
  dateEcheance?: string | null;
  source?: string; // « manuel », « scan_facture », « vocal »…
  // Date de la pièce (scanner : date lue sur la facture). Défaut : maintenant.
  date?: Date;
  // Vente à crédit PARTIELLEMENT payée (scanner : « reste » lu sur la facture) :
  // la créance ne porte que sur le reste, pas sur le total.
  montantRestantCredit?: number | null;
}): Promise<{ venteIds: string[]; transactionId: string }> {
  const { userId, lignes } = params;
  const dateOperation = params.date ?? new Date();
  const modePaiement = params.modePaiement;
  const client = params.clientNom?.trim() ?? "";
  const clientTelephone = params.clientTelephone ?? null;
  const dateEcheance = params.dateEcheance ?? null;

  const venteIds: string[] = [];
  // Identifiant de « transaction » commun à toutes les lignes du panier :
  // permet de compter les VENTES (transactions) séparément des UNITÉS vendues.
  const transactionId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await database.write(async () => {
    for (const ligne of lignes) {
      const vente = await database.get("ventes").create((v: any) => {
        v.userId = userId;
        v.produitId = ligne.produitId;
        v.produitNom = ligne.nom;
        v.quantite = ligne.quantite;
        v.prixUnitaire = ligne.prixUnitaire;
        v.clientNom = client || null;
        v.clientTelephone = clientTelephone;
        v.modePaiement = modePaiement;
        v.source = params.source ?? "manuel";
        v.donneesSupplementairesJson = JSON.stringify({ transactionId });
        v.creeLe = dateOperation;
        v.synchronise = false;
      });
      venteIds.push(vente.id);
    }

    // Paiement à crédit → on crée la créance correspondante.
    if (modePaiement === "credit") {
      const totalVente = lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
      // Paiement partiel : la créance ne porte que sur le reste dû.
      const restant = params.montantRestantCredit != null && params.montantRestantCredit >= 0
        ? Math.min(params.montantRestantCredit, totalVente)
        : totalVente;
      if (restant > 0) {
        await database.get("creances_dettes").create((c: any) => {
          c.userId = userId;
          c.type = "creance";
          c.personneNom = client;
          c.telephone = clientTelephone;
          c.montantInitial = restant;
          c.montantRestant = restant;
          c.dateEcheance = dateEcheance;
          c.statut = "en_cours";
          c.note = null;
          c.produitConcerne = null;
          c.creeLe = dateOperation;
          c.synchronise = false;
        });
      }
    }
  });

  // Déduit le stock APRÈS l'écriture des ventes (transaction séparée,
  // car enregistrerMouvementStock a sa propre database.write).
  for (const ligne of lignes) {
    if (ligne.produitId) {
      await enregistrerMouvementStock({
        userId: userId,
        produitId: ligne.produitId,
        type: "vente",
        quantite: -ligne.quantite,
        raison: "Vente",
      });
    }
  }

  synchroniserPourUtilisateurCourant().catch(() => {});
  await enregistrerActivite("vente", "ajout", `Vente enregistrée : ${lignes.map((l) => `${l.quantite} × ${l.nom}`).join(", ")}`);

  return { venteIds, transactionId };
}
