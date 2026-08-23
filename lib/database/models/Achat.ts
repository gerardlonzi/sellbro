import { Model } from "@nozbe/watermelondb";
import { field, text, date, readonly } from "@nozbe/watermelondb/decorators";

export default class Achat extends Model {
  static table = "achats";

  @text("remote_id") remoteId!: string | null;
  @text("user_id") userId!: string;
  @text("fournisseur_nom") fournisseurNom!: string | null;
  @text("description") description!: string | null;
  @field("montant") montant!: number;
  @text("source") source!: string;
  @text("facture_image_url") factureImageUrl!: string | null;
  @text("donnees_supplementaires") donneesSupplementairesJson!: string;
  @field("synchronise") synchronise!: boolean;
  @readonly @date("cree_le") creeLe!: Date;
}