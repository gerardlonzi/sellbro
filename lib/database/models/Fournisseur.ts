import { Model } from "@nozbe/watermelondb";
import { field, text, date, readonly } from "@nozbe/watermelondb/decorators";

export default class Fournisseur extends Model {
  static table = "fournisseurs";
  @text("remote_id") remoteId!: string | null;
  @text("user_id") userId!: string;
  @text("nom") nom!: string;
  @text("telephone") telephone!: string | null;
  @text("adresse") adresse!: string | null;
  @field("total_achats") totalAchats!: number;
  @field("montant_du") montantDu!: number;
  @field("synchronise") synchronise!: boolean;
  @readonly @date("cree_le") creeLe!: Date;
}