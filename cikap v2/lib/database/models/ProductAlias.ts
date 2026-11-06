import { Model } from "@nozbe/watermelondb";
import { field, text, date } from "@nozbe/watermelondb/decorators";

export default class ProductAlias extends Model {
  static table = "product_aliases";

  @text("remote_id") remoteId!: string | null;
  @text("user_id") userId!: string;
  @text("produit_id") produitId!: string;
  @text("alias") alias!: string;
  @text("alias_normalise") aliasNormalise!: string;
  @text("source") source!: string;
  @field("confiance") confiance!: number | null;
  @field("synchronise") synchronise!: boolean;
  @date("cree_le") creeLe!: Date;
}
