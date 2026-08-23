import { Q } from "@nozbe/watermelondb";
import { database } from "./index";
import { supabase } from "@/lib/supabase/client";

// Envoie vers Supabase tout ce qui a été créé hors ligne et jamais synchronisé.
export async function pousserDonneesLocales() {
  const tables: { nom: string; table: string }[] = [
    { nom: "produits", table: "produits" },
    { nom: "ventes", table: "ventes" },
    { nom: "achats", table: "achats" },
    { nom: "creances_dettes", table: "creances_dettes" },
  ];

  for (const t of tables) {
    const collection = database.get(t.nom);
    const nonSynchronises = await collection.query(Q.where("synchronise", false)).fetch();

    for (const enregistrement of nonSynchronises as any[]) {
      const payload = construireDonneesEnvoi(t.nom, enregistrement);
      const { data, error } = await supabase.from(t.table).insert(payload).select("id").single();

      if (!error && data) {
        await database.write(async () => {
          await enregistrement.update((e: any) => {
            e.synchronise = true;
            e.remoteId = data.id;
          });
        });
      }
    }
  }
}

function construireDonneesEnvoi(nomTable: string, e: any) {
  if (nomTable === "produits") {
    return {
      user_id: e.userId, nom: e.nom, categorie_nom: e.categorieNom,
      prix_vente: e.prixVente, prix_achat: e.prixAchat,
      quantite_stock: e.quantiteStock, seuil_alerte: e.seuilAlerte,
      champs_supplementaires: JSON.parse(e.champsSupplementairesJson || "{}"),
    };
  }
  if (nomTable === "ventes") {
    return {
      user_id: e.userId, produit_id: e.produitId, quantite: e.quantite, prix_unitaire: e.prixUnitaire,
      client_nom: e.clientNom, client_telephone: e.clientTelephone, mode_paiement: e.modePaiement,
      source: e.source, donnees_supplementaires: JSON.parse(e.donneesSupplementairesJson || "{}"),
    };
  }
  if (nomTable === "achats") {
    return {
      user_id: e.userId, fournisseur_nom: e.fournisseurNom, description: e.description,
      montant: e.montant, source: e.source, donnees_supplementaires: JSON.parse(e.donneesSupplementairesJson || "{}"),
    };
  }
  // creances_dettes
  return {
    user_id: e.userId, type: e.type, personne_nom: e.personneNom, telephone: e.telephone,
    montant_initial: e.montantInitial, montant_restant: e.montantRestant, date_echeance: e.dateEcheance,
    statut: e.statut, note: e.note, produit_concerne: e.produitConcerne,
  };
}

// Récupère les dernières données Supabase et rafraîchit le cache local
// (approche simple : on remplace le cache, pas une fusion incrémentale
// avec résolution de conflits — suffisant pour un utilisateur mono-appareil).
export async function tirerDonneesDistantes(userId: string) {
  const [produits, ventes, achats, creances] = await Promise.all([
    supabase.from("produits").select("*").eq("user_id", userId),
    supabase.from("ventes").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
    supabase.from("achats").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
    supabase.from("creances_dettes").select("*").eq("user_id", userId),
  ]);

  await database.write(async () => {
    await remplacerTable("produits", produits.data ?? [], (r) => ({
      remoteId: r.id, userId: r.user_id, categorieNom: r.categorie_nom, nom: r.nom,
      prixVente: r.prix_vente, prixAchat: r.prix_achat, quantiteStock: r.quantite_stock,
      seuilAlerte: r.seuil_alerte, champsSupplementairesJson: JSON.stringify(r.champs_supplementaires ?? {}), synchronise: true,
    }));
    await remplacerTable("ventes", ventes.data ?? [], (r) => ({
      remoteId: r.id, userId: r.user_id, produitId: r.produit_id, produitNom: null,
      quantite: r.quantite, prixUnitaire: r.prix_unitaire, clientNom: r.client_nom, clientTelephone: r.client_telephone,
      modePaiement: r.mode_paiement, source: r.source, audioUrl: r.audio_url, imageFactureUrl: r.image_facture_url,
      donneesSupplementairesJson: JSON.stringify(r.donnees_supplementaires ?? {}), synchronise: true,
    }));
    await remplacerTable("achats", achats.data ?? [], (r) => ({
      remoteId: r.id, userId: r.user_id, fournisseurNom: r.fournisseur_nom, description: r.description,
      montant: r.montant, source: r.source, factureImageUrl: r.facture_image_url,
      donneesSupplementairesJson: JSON.stringify(r.donnees_supplementaires ?? {}), synchronise: true,
    }));
    await remplacerTable("creances_dettes", creances.data ?? [], (r) => ({
      remoteId: r.id, userId: r.user_id, type: r.type, personneNom: r.personne_nom, telephone: r.telephone,
      montantInitial: r.montant_initial, montantRestant: r.montant_restant, dateEcheance: r.date_echeance,
      statut: r.statut, note: r.note, produitConcerne: r.produit_concerne, synchronise: true,
    }));
  });
}

async function remplacerTable(nomTable: string, lignesDistantes: any[], mapper: (r: any) => any) {
  const collection = database.get(nomTable);
  const existants = await collection.query(Q.where("synchronise", true)).fetch();
  await Promise.all(existants.map((e) => e.destroyPermanently()));

  for (const ligne of lignesDistantes) {
    await collection.create((nouveau: any) => Object.assign(nouveau, mapper(ligne)));
  }
}

export async function synchroniserTout(userId: string) {
  await pousserDonneesLocales();
  await tirerDonneesDistantes(userId);
}