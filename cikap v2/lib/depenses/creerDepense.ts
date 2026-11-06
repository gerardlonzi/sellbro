import { database } from "@/lib/database";
import { synchroniserPourUtilisateurCourant } from "@/lib/database/sync";
import { enregistrerActivite } from "@/lib/audit/journal";

// Service métier UNIQUE de création de dépense : utilisé par l'écran
// « Nouvelle dépense » ET par le scanner de factures.
export async function creerDepense(params: {
  userId: string;
  categorie: string;
  description?: string;
  montant: number;
  donnees?: Record<string, unknown>; // fournisseur, produit lié, champs perso…
  descriptionAudit?: string;
  // Date de la pièce (scanner : date lue sur la facture). Défaut : maintenant.
  date?: Date;
}): Promise<void> {
  await database.write(async () => {
    await database.get("depenses").create((d: any) => {
      d.userId = params.userId;
      d.categorie = params.categorie;
      d.description = params.description?.trim() || null;
      d.montant = params.montant;
      d.donneesSupplementairesJson = JSON.stringify(params.donnees ?? {});
      d.creeLe = params.date ?? new Date();
      d.synchronise = false;
    });
  });

  synchroniserPourUtilisateurCourant().catch(() => {});
  await enregistrerActivite("depense", "ajout", params.descriptionAudit ?? "Nouvelle dépense");
}
