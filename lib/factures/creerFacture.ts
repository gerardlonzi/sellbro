import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { enregistrerActivite } from "@/lib/audit/journal";

async function genererNumero(userId: string): Promise<string> {
  const existantes = await database.get("factures" as any).query(Q.where("user_id", userId)).fetchCount();
  return `INV-${String(existantes + 1).padStart(6, "0")}`;
}

// Regroupe plusieurs lignes de vente (même client, même journée) en une facture.
export async function creerFactureDepuisVentes(userId: string, venteIds: string[]) {
  const ventes = await Promise.all(venteIds.map((id) => database.get("ventes").find(id)));
  const lignes = ventes as any[];

  const sousTotal = lignes.reduce((s, v) => s + v.quantite * v.prixUnitaire, 0);
  const numero = await genererNumero(userId);
  const clientNom = lignes[0]?.clientNom ?? null;
  const clientTelephone = lignes[0]?.clientTelephone ?? null;

  let factureId = "";
  await database.write(async () => {
    const facture = await database.get("factures" as any).create((f: any) => {
      f.userId = userId;
      f.numero = numero;
      f.clientNom = clientNom;
      f.clientTelephone = clientTelephone;
      f.sousTotal = sousTotal;
      f.remise = 0;
      f.total = sousTotal;
      f.statut = "en_attente";
      f.montantPaye = 0;
      f.creeLe = new Date();
      f.synchronise = false;
    });
    factureId = facture.id;

    for (const ligne of lignes) {
      await database.get("facture_lignes" as any).create((l: any) => {
        l.factureId = factureId;
        l.venteId = ligne.id;
        l.produitNom = ligne.produitNom ?? "—";
        l.quantite = ligne.quantite;
        l.prixUnitaire = ligne.prixUnitaire;
      });
    }
  });

  await enregistrerActivite("facture", "ajout", `Facture ${numero} créée`);
  return factureId;
}