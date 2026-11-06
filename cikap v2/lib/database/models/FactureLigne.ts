import { Model } from "@nozbe/watermelondb";
import { field, text } from "@nozbe/watermelondb/decorators";

export default class FactureLigne extends Model {
  static table = "facture_lignes";
  @text("remote_id") remoteId!: string | null;
  @text("facture_id") factureId!: string;
  @text("vente_id") venteId!: string | null;
  @text("produit_nom") produitNom!: string;
  @field("quantite") quantite!: number;
  @field("prix_unitaire") prixUnitaire!: number;
}