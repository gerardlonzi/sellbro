import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { signalerModificationDonnees } from "@/lib/dataVersion";
import { normaliserLibelle } from "./normalisation";
import { AliasProduit } from "./types";

// Alias produits du commerçant (niveau 5 du matching, §7) : chaque
// correspondance CONFIRMÉE par l'utilisateur est mémorisée, et la prochaine
// facture contenant le même libellé retrouve le produit automatiquement.
// Stockés en local (WatermelonDB) et synchronisés — isolés par user_id.

export async function chargerAlias(userId: string): Promise<AliasProduit[]> {
  const lignes = await database.get("product_aliases").query(Q.where("user_id", userId)).fetch();
  return (lignes as any[])
    .filter((a) => a.produitId) // alias orphelin (produit supprimé) : ignoré
    .map((a) => ({
      id: a.id,
      userId: a.userId,
      produitId: a.produitId,
      alias: a.alias,
      aliasNormalise: a.aliasNormalise,
      source: a.source as AliasProduit["source"],
      confiance: a.confiance,
    }));
}

// Enregistre (ou met à jour) un alias après confirmation de l'utilisateur.
// Unicité par (user_id, alias normalisé) : un libellé ne pointe que vers UN
// produit — la dernière confirmation de l'utilisateur l'emporte.
export async function enregistrerAlias(params: {
  userId: string;
  produitId: string;
  alias: string;
  source: AliasProduit["source"];
  confiance?: number | null;
}): Promise<void> {
  const aliasNormalise = normaliserLibelle(params.alias);
  if (!aliasNormalise) return;

  await database.write(async () => {
    const existants = (await database
      .get("product_aliases")
      .query(Q.where("user_id", params.userId), Q.where("alias_normalise", aliasNormalise))
      .fetch()) as any[];

    if (existants.length > 0) {
      await existants[0].update((a: any) => {
        a.produitId = params.produitId;
        a.alias = params.alias;
        a.source = params.source;
        a.confiance = params.confiance ?? null;
        a.synchronise = false;
      });
      // Nettoie les doublons éventuels.
      for (const extra of existants.slice(1)) await extra.destroyPermanently();
    } else {
      await database.get("product_aliases").create((a: any) => {
        a.userId = params.userId;
        a.produitId = params.produitId;
        a.alias = params.alias;
        a.aliasNormalise = aliasNormalise;
        a.source = params.source;
        a.confiance = params.confiance ?? null;
        a.creeLe = new Date();
        a.synchronise = false;
      });
    }
  });
  signalerModificationDonnees();
}
