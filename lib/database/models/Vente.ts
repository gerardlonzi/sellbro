import { Model } from "@nozbe/watermelondb";
import { field, text, date, readonly } from "@nozbe/watermelondb/decorators";

export default class Vente extends Model {
  static table = "ventes";

  @text("remote_id") remoteId!: string | null;
  @text("user_id") userId!: string;
  @text("produit_id") produitId!: string | null;
  @text("produit_nom") produitNom!: string | null;
  @field("quantite") quantite!: number;
  @field("prix_unitaire") prixUnitaire!: number;
  @text("client_nom") clientNom!: string | null;
  @text("client_telephone") clientTelephone!: string | null;
  @text("mode_paiement") modePaiement!: string | null;
  @text("source") source!: string;
  @text("audio_url") audioUrl!: string | null;
  @text("image_facture_url") imageFactureUrl!: string | null;
  @text("donnees_supplementaires") donneesSupplementairesJson!: string;
  @field("synchronise") synchronise!: boolean;
  @readonly @date("cree_le") creeLe!: Date;
}