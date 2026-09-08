import { database } from "@/lib/database";
import { obtenirUserId } from "@/lib/auth/userCache";

export type ActionType = "ajout" | "modification" | "suppression" | "alerte";

// Enregistre une ligne dans le journal d'activité (local, WatermelonDB).
// Ne doit jamais faire planter l'app : on avale les erreurs silencieusement.
export async function enregistrerActivite(type: string, action: ActionType, description: string) {
  try {
    const userId = await obtenirUserId();
    if (!userId) return;
    await database.write(async () => {
      await database.get("journal_activite").create((j: any) => {
        j.userId = userId;
        j.type = type;
        j.action = action;
        j.description = description;
        j.creeLe = new Date();
        j.synchronise = false;
      });
    });
  } catch {
    // Silencieux : le journal ne doit pas bloquer l'utilisateur.
  }
}