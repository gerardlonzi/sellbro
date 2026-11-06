import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { synchroniserPourUtilisateurCourant } from "@/lib/database/sync";
import { enregistrerActivite } from "@/lib/audit/journal";

export type CreanceOuverte = {
  id: string;
  type: "creance" | "dette";
  personneNom: string;
  montantRestant: number;
};

export async function listerCreancesOuvertes(
  userId: string,
  type: "creance" | "dette",
  nom?: string
): Promise<CreanceOuverte[]> {
  const lignes = (await database
    .get("creances_dettes")
    .query(Q.where("user_id", userId), Q.where("type", type), Q.where("statut", "en_cours"))
    .fetch()) as any[];

  const nomNorm = nom?.trim().toLowerCase() ?? "";
  return lignes
    .filter((c) => c.montantRestant > 0)
    .filter((c) => !nomNorm || (c.personneNom ?? "").toLowerCase().includes(nomNorm))
    .sort((a, b) => b.creeLe.getTime() - a.creeLe.getTime())
    .map((c) => ({
      id: c.id,
      type: c.type,
      personneNom: c.personneNom,
      montantRestant: c.montantRestant,
    }));
}

// Applique un paiement à une créance/dette EXISTANTE. Jamais d'écriture
// décidée par l'IA : l'utilisateur a choisi la ligne à solder.
export async function enregistrerPaiementCreance(params: {
  userId: string;
  creanceId: string;
  montant: number;
  note?: string;
}): Promise<"ok" | "introuvable" | "montant_invalide"> {
  if (!(params.montant > 0)) return "montant_invalide";

  let trouvee: any = null;
  try {
    trouvee = await database.get("creances_dettes").find(params.creanceId);
  } catch {
    return "introuvable";
  }
  if (!trouvee || trouvee.userId !== params.userId) return "introuvable";

  const paye = Math.min(params.montant, trouvee.montantRestant);
  const restant = Math.max(0, Math.round((trouvee.montantRestant - paye) * 100) / 100);

  await database.write(async () => {
    await trouvee.update((c: any) => {
      c.montantRestant = restant;
      c.statut = restant <= 0 ? "payee" : "en_cours";
      if (params.note) {
        const precedente = c.note ? `${c.note}\n` : "";
        c.note = `${precedente}${params.note}`;
      }
      c.synchronise = false;
    });
  });

  synchroniserPourUtilisateurCourant().catch(() => {});
  await enregistrerActivite(
    "creance",
    "modification",
    `Paiement de ${paye} sur ${trouvee.personneNom}`
  );
  return "ok";
}
