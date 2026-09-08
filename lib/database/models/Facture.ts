import { Model } from "@nozbe/watermelondb";
import { field, text, date } from "@nozbe/watermelondb/decorators";

export default class Facture extends Model {
  static table = "factures";
  @text("remote_id") remoteId!: string | null;
  @text("user_id") userId!: string;
  @text("numero") numero!: string;
  @text("client_nom") clientNom!: string | null;
  @text("client_telephone") clientTelephone!: string | null;
  @field("sous_total") sousTotal!: number;
  @field("remise") remise!: number;
  @field("total") total!: number;
  @text("statut") statut!: string;
  @field("montant_paye") montantPaye!: number;
  @field("synchronise") synchronise!: boolean;
  @date("cree_le") creeLe!: Date;
}