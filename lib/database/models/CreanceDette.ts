import { Model } from "@nozbe/watermelondb";
import { field, text, date, readonly } from "@nozbe/watermelondb/decorators";

export default class CreanceDette extends Model {
  static table = "creances_dettes";

  @text("remote_id") remoteId!: string | null;
  @text("user_id") userId!: string;
  @text("type") type!: string;
  @text("personne_nom") personneNom!: string;
  @text("telephone") telephone!: string | null;
  @field("montant_initial") montantInitial!: number;
  @field("montant_restant") montantRestant!: number;
  @text("date_echeance") dateEcheance!: string | null;
  @text("statut") statut!: string;
  @text("note") note!: string | null;
  @text("produit_concerne") produitConcerne!: string | null;
  @field("synchronise") synchronise!: boolean;
  @readonly @date("cree_le") creeLe!: Date;
}