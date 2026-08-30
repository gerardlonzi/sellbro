import { Model } from "@nozbe/watermelondb";
import { field, text, date, readonly } from "@nozbe/watermelondb/decorators";

export default class Depense extends Model {
  static table = "depenses";
  @text("remote_id") remoteId!: string | null;
  @text("user_id") userId!: string;
  @text("categorie") categorie!: string;
  @text("description") description!: string | null;
  @field("montant") montant!: number;
  @field("synchronise") synchronise!: boolean;
  @readonly @date("cree_le") creeLe!: Date;
}