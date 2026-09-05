import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";

type TypeMouvement = "achat" | "vente" | "retour" | "casse" | "ajustement" | "peremption";

// Enregistre un mouvement ET met à jour le stock du produit en une seule
// opération, pour ne jamais avoir de désynchronisation entre les deux.
export async function enregistrerMouvementStock(params: {
  userId: string;
  produitId: string;
  type: TypeMouvement;
  quantite: number; // positif = entrée, négatif = sortie
  raison?: string;
}) {
  const produit = await database.get("produits").find(params.produitId);
  const stockAvant = (produit as any).quantiteStock;
  const stockApres = Math.max(0, stockAvant + params.quantite);

  await database.write(async () => {
    await (produit as any).update((p: any) => {
      p.quantiteStock = stockApres;
    });

    await database.get("mouvements_stock").create((m: any) => {
      m.userId = params.userId;
      m.produitId = params.produitId;
      m.type = params.type;
      m.quantite = params.quantite;
      m.stockAvant = stockAvant;
      m.stockApres = stockApres;
      m.raison = params.raison ?? null;
      m.synchronise = false;
    });
  });

  return { stockAvant, stockApres };
}

export async function historiqueMouvements(produitId: string) {
  const resultats = await database.get("mouvements_stock").query(Q.where("produit_id", produitId), Q.sortBy("cree_le", Q.desc)).fetch();
  return resultats as any[];
}