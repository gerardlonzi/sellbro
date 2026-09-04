import { Model } from "@nozbe/watermelondb";
import { field, text, date, readonly } from "@nozbe/watermelondb/decorators";

export default class MouvementStock extends Model {
  static table = "mouvements_stock";
  @text("remote_id") remoteId!: string | null;
  @text("user_id") userId!: string;
  @text("produit_id") produitId!: string;
  @text("type") type!: string;
  @field("quantite") quantite!: number;
  @field("stock_avant") stockAvant!: number;
  @field("stock_apres") stockApres!: number;
  @text("raison") raison!: string | null;
  @field("synchronise") synchronise!: boolean;
  @readonly @date("cree_le") creeLe!: Date;
}