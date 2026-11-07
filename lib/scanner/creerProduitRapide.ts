import { database } from "@/lib/database";
import { signalerModificationDonnees } from "@/lib/dataVersion";
import { synchroniserPourUtilisateurCourant } from "@/lib/database/sync";
import { enregistrerActivite } from "@/lib/audit/journal";

// Création d'un produit depuis l'écran de validation d'un scan. JAMAIS
// automatique : l'utilisateur doit l'avoir demandé ET confirmé. Le produit est
// créé au minimum (nom, prix de vente lu sur la facture, stock 0) ; le stock
// est ensuite ajusté par l'opération (achat → +, vente → −).
export async function creerProduitRapide(params: {
  userId: string;
  nom: string;
  prixVente?: number | null;
  prixAchat?: number | null;
}): Promise<{ id: string; nom: string; prixVente: number }> {
  const nom = params.nom.trim();
  let id = "";
  const prixVente = Math.max(0, params.prixVente ?? 0);
  await database.write(async () => {
    const produit = await database.get("produits").create((p: any) => {
      p.userId = params.userId;
      p.nom = nom;
      p.categorieNom = null;
      p.prixVente = prixVente;
      p.prixAchat = params.prixAchat ?? null;
      p.quantiteStock = 0;
      p.seuilAlerte = 5;
      p.champsSupplementairesJson = "{}";
      p.creeLe = new Date();
      p.synchronise = false;
    });
    id = produit.id;
  });
  signalerModificationDonnees();
  synchroniserPourUtilisateurCourant().catch(() => {});
  await enregistrerActivite("produit", "ajout", `Produit créé depuis un scan : ${nom}`).catch(() => {});
  return { id, nom, prixVente };
}
