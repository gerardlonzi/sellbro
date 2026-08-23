import { Model } from "@nozbe/watermelondb";
import { field, text, date, readonly } from "@nozbe/watermelondb/decorators";

export default class Produit extends Model {
  static table = "produits";

  @text("remote_id") remoteId!: string | null;
  @text("user_id") userId!: string;
  @text("categorie_nom") categorieNom!: string | null;
  @text("nom") nom!: string;
  @field("prix_vente") prixVente!: number;
  @field("prix_achat") prixAchat!: number | null;
  @field("quantite_stock") quantiteStock!: number;
  @field("seuil_alerte") seuilAlerte!: number;
  @text("champs_supplementaires") champsSupplementairesJson!: string;
  @field("synchronise") synchronise!: boolean;
  @readonly @date("cree_le") creeLe!: Date;

  get champsSupplementaires(): Record<string, string> {
    try { return JSON.parse(this.champsSupplementairesJson || "{}"); } catch { return {}; }
  }
}