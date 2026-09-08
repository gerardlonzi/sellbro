import { Model } from "@nozbe/watermelondb";
import { field, text, date } from "@nozbe/watermelondb/decorators";

export default class JournalActivite extends Model {
  static table = "journal_activite";

  @text("remote_id") remoteId!: string | null;
  @text("user_id") userId!: string;
  @text("type") type!: string;
  @text("action") action!: string;
  @text("description") description!: string;
  @date("cree_le") creeLe!: Date;
  @field("synchronise") synchronise!: boolean;
}