import { Q } from "@nozbe/watermelondb";
import { database } from "./index";
import { supabase } from "@/lib/supabase/client";
import { etatPlanActuel, rafraichirPlan } from "@/lib/plan/planStore";
import { estEssaiActifLocal } from "@/lib/trial/deviceTrial";
import { signalerModificationDonnees } from "@/lib/dataVersion";
import { lireSuppressions, effacerSuppression } from "@/lib/sync/tombstones";
import { setEtatSync } from "@/lib/sync/syncStatus";

// La sync cloud est active dès le PREMIER jour (pendant l'essai gratuit),
// puis en permanence pour les abonnés Premium. Elle s'arrête si l'essai
// expire sans abonnement (mode lecture seule).
// (Les données d'identité dans `profiles` sont, elles, toujours côté Supabase
// pour tous, car l'authentification par email l'exige.)
async function peutSynchroniser(): Promise<boolean> {
  let etat = etatPlanActuel();
  if (!etat.pret) {
    await rafraichirPlan();
    etat = etatPlanActuel();
  }
  if (etat.planId === "premium") return true;
  return await estEssaiActifLocal();
}

// ---------------------------------------------------------------------------
// PUSH (local → Supabase)
// ---------------------------------------------------------------------------

// Construit la correspondance id local → id distant à partir de TOUS les
// produits déjà synchronisés (pas seulement ceux poussés dans cette session) :
// c'est ce qui permet aux ventes/mouvements de référencer le bon produit
// distant même si celui-ci a été synchronisé lors d'une session précédente.
async function carteProduitsLocalVersDistant(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const tous = (await database.get("produits").query().fetch()) as any[];
  for (const p of tous) {
    if (p.remoteId) map.set(p.id, p.remoteId);
  }
  return map;
}

async function pousserTable(
  table: string,
  mapper: (e: any, cartes: CartesEnvoi) => any,
  cartes: CartesEnvoi
) {
  const collection = database.get(table);
  const nonSync = (await collection.query(Q.where("synchronise", false)).fetch()) as any[];
  for (const e of nonSync) {
    const payload = mapper(e, cartes);
    let data: any = null;
    let error: any = null;
    if (e.remoteId) {
      // Déjà poussé précédemment : UPDATE. Un INSERT ici créerait un doublon
      // côté serveur (ex: produit modifié après une vente), que le pull
      // réimporterait ensuite comme un second enregistrement local.
      ({ error } = await supabase.from(table).update(payload).eq("id", e.remoteId));
      data = { id: e.remoteId };
    } else {
      ({ data, error } = await supabase.from(table).insert(payload).select("id").single());
    }
    if (!error && data) {
      await database.write(async () => {
        await e.update((x: any) => {
          x.synchronise = true;
          x.remoteId = data.id;
        });
      });
    }
  }
}

type CartesEnvoi = {
  produit: Map<string, string>;
  vente: Map<string, string>;
  facture: Map<string, string>;
};

// Envoie vers Supabase tout ce qui a été créé hors ligne et jamais synchronisé.
export async function pousserDonneesLocales() {
  // 0) Suppressions locales → suppression côté Supabase (tombstones).
  //    Doit précéder le push/pull pour éviter que le pull ré-importe
  //    un enregistrement supprimé localement.
  const suppressions = await lireSuppressions();
  for (const s of suppressions) {
    const { error } = await supabase.from(s.table).delete().eq("id", s.remoteId);
    if (!error) await effacerSuppression(s.table, s.remoteId);
  }

  const cartes: CartesEnvoi = {
    produit: await carteProduitsLocalVersDistant(),
    vente: new Map(),
    facture: new Map(),
  };

  // 1) Produits (sans FK, construit la carte pour les autres tables).
  await pousserTable("produits", (e) => {
    const supp = JSON.parse(e.champsSupplementairesJson || "{}");
    return {
      user_id: e.userId,
      nom: e.nom,
      prix_vente: e.prixVente,
      prix_achat: e.prixAchat,
      quantite_stock: e.quantiteStock,
      seuil_alerte: e.seuilAlerte,
      // Pas de colonne categorie_nom côté Supabase (c'est categorie_id) :
      // on range le nom dans le jsonb pour ne pas le perdre.
      champs_supplementaires: { ...supp, categorie_nom: e.categorieNom },
    };
  }, cartes);
  // Met à jour la carte avec les produits fraîchement poussés.
  const tousProduits = (await database.get("produits").query().fetch()) as any[];
  for (const p of tousProduits) if (p.remoteId) cartes.produit.set(p.id, p.remoteId);

  // 2) Fournisseurs (sans FK entrante).
  await pousserTable("fournisseurs", (e) => ({
    user_id: e.userId,
    nom: e.nom,
    telephone: e.telephone,
    adresse: e.adresse ?? null,
    total_achats: e.totalAchats ?? 0,
    montant_du: e.montantDu ?? 0,
  }), cartes);

  // 3) Ventes (référence produit_id).
  await pousserTable("ventes", (e, c) => {
    const supp = JSON.parse(e.donneesSupplementairesJson || "{}");
    const produitDistant = e.produitId ? c.produit.get(e.produitId) ?? null : null;
    return {
      user_id: e.userId,
      produit_id: produitDistant,
      quantite: e.quantite,
      prix_unitaire: e.prixUnitaire,
      client_nom: e.clientNom,
      client_telephone: e.clientTelephone,
      mode_paiement: e.modePaiement,
      source: e.source,
      audio_url: e.audioUrl,
      image_facture_url: e.imageFactureUrl,
      // Le nom du produit (dénormalisé) survit au changement d'appareil,
      // même si le produit est supprimé entre-temps.
      donnees_supplementaires: { ...supp, produit_nom: e.produitNom },
    };
  }, cartes);
  const tousVentes = (await database.get("ventes").query().fetch()) as any[];
  for (const v of tousVentes) if (v.remoteId) cartes.vente.set(v.id, v.remoteId);

  // 4) Mouvements de stock (référence produit_id, NOT NULL côté Supabase).
  await pousserTable("mouvements_stock", (e, c) => ({
    user_id: e.userId,
    produit_id: e.produitId ? c.produit.get(e.produitId) ?? null : null,
    type: e.type,
    quantite: e.quantite,
    stock_avant: e.stockAvant,
    stock_apres: e.stockApres,
    raison: e.raison,
  }), cartes);

  // 5) Achats, créances/dettes, dépenses (sans FK locale).
  await pousserTable("achats", (e) => ({
    user_id: e.userId,
    fournisseur_nom: e.fournisseurNom,
    description: e.description,
    montant: e.montant,
    source: e.source,
    facture_image_url: e.factureImageUrl,
    donnees_supplementaires: JSON.parse(e.donneesSupplementairesJson || "{}"),
  }), cartes);

  await pousserTable("creances_dettes", (e) => ({
    user_id: e.userId,
    type: e.type,
    personne_nom: e.personneNom,
    telephone: e.telephone,
    montant_initial: e.montantInitial,
    montant_restant: e.montantRestant,
    date_echeance: e.dateEcheance,
    statut: e.statut,
    note: e.note,
    produit_concerne: e.produitConcerne,
  }), cartes);

  await pousserTable("depenses", (e) => ({
    user_id: e.userId,
    categorie: e.categorie,
    description: e.description,
    montant: e.montant,
  }), cartes);

  // 6) Factures puis leurs lignes.
  await pousserTable("factures", (e) => ({
    user_id: e.userId,
    numero: e.numero,
    client_nom: e.clientNom,
    client_telephone: e.clientTelephone,
    sous_total: e.sousTotal,
    remise: e.remise,
    total: e.total,
    statut: e.statut,
    montant_paye: e.montantPaye,
  }), cartes);
  const tousFactures = (await database.get("factures").query().fetch()) as any[];
  for (const f of tousFactures) if (f.remoteId) cartes.facture.set(f.id, f.remoteId);

  // facture_lignes n'a pas de colonne `synchronise` : on suit via remote_id.
  const lignesNonSync = (await database
    .get("facture_lignes")
    .query(Q.where("remote_id", Q.eq(null)))
    .fetch()) as any[];
  for (const l of lignesNonSync) {
    const factureDistant = cartes.facture.get(l.factureId) ?? null;
    const venteDistant = l.venteId ? cartes.vente.get(l.venteId) ?? null : null;
    if (!factureDistant) continue;
    const { data, error } = await supabase.from("facture_lignes").insert({
      facture_id: factureDistant,
      vente_id: venteDistant,
      produit_nom: l.produitNom,
      quantite: l.quantite,
      prix_unitaire: l.prixUnitaire,
    }).select("id").single();
    if (!error && data) {
      await database.write(async () => {
        await l.update((x: any) => { x.remoteId = data.id; });
      });
    }
  }

  // 7) Journal d'activité.
  await pousserTable("journal_activite", (e) => ({
    user_id: e.userId,
    type: e.type,
    action: e.action,
    description: e.description,
  }), cartes);
}

// ---------------------------------------------------------------------------
// PULL (Supabase → local)
// ---------------------------------------------------------------------------

// Récupère les dernières données Supabase et rafraîchit le cache local
// (remplacement simple du cache : suffisant pour un utilisateur mono-appareil).
export async function tirerDonneesDistantes(userId: string) {
  const [produits, ventes, achats, creances, depenses, fournisseurs, mouvements, factures, factureLignes, journal] =
    await Promise.all([
      supabase.from("produits").select("*").eq("user_id", userId),
      supabase.from("ventes").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
      supabase.from("achats").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
      supabase.from("creances_dettes").select("*").eq("user_id", userId),
      supabase.from("depenses").select("*").eq("user_id", userId),
      supabase.from("fournisseurs").select("*").eq("user_id", userId),
      supabase.from("mouvements_stock").select("*").eq("user_id", userId),
      supabase.from("factures").select("*").eq("user_id", userId),
      supabase.from("facture_lignes").select("*"),
      supabase.from("journal_activite").select("*").eq("user_id", userId),
    ]);

  // Cartes remote id → id local, construites au fur et à mesure.
  const produitLocal = new Map<string, string>();
  const venteLocal = new Map<string, string>();
  const factureLocal = new Map<string, string>();

  // 1) Produits d'abord (les autres tables référencent produit_id).
  await tirerProduits(produits.data ?? [], produitLocal);

  // 2) Fournisseurs (référencé par rien en local, indépendant).
  await tirerFournisseurs(fournisseurs.data ?? []);

  // 3) Ventes (référence produit_id), construit la carte pour facture_lignes.
  await tirerVentes(ventes.data ?? [], produitLocal, venteLocal);

  // 4) Le reste, chaque table isolée dans son try/catch pour qu'un échec
  //    n'annule pas la restauration des autres.
  await tirerAchats(achats.data ?? []);
  await tirerCreances(creances.data ?? []);
  await tirerDepenses(depenses.data ?? []);
  await tirerMouvements(mouvements.data ?? [], produitLocal);
  await tirerFactures(factures.data ?? [], factureLocal);
  await tirerFactureLignes(factureLignes.data ?? [], factureLocal, venteLocal);
  await tirerJournal(journal.data ?? []);
}

// Upsert par `remote_id` : met à jour les enregistrements existants (en
// préservant leur id local, pour ne pas casser les références de l'UI) et crée
// les nouveaux. Supprime ceux dont le remote_id n'existe plus côté serveur.
// Retourne la map remoteId → id local.
async function upsertParRemoteId(
  nomTable: string,
  lignesDistantes: any[],
  mapper: (r: any) => any
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const collection = database.get(nomTable);
  // On matche par remoteId sur TOUS les enregistrements qui en ont un (pas
  // seulement synchronise=true) : un enregistrement dont le push a échoué
  // garde son remoteId et ne doit pas être recréé en doublon au pull.
  const existants = (await collection.query(Q.where("remote_id", Q.notEq(null))).fetch()) as any[];
  const parRemoteId = new Map(existants.map((e: any) => [e.remoteId, e]));
  const remoteIdsVus = new Set<string>();

  for (const ligne of lignesDistantes) {
    const data = mapper(ligne);
    remoteIdsVus.add(ligne.id);
    const existant = parRemoteId.get(ligne.id);
    if (existant) {
      await existant.update((rec: any) => {
        Object.assign(rec, data);
      });
      map.set(ligne.id, existant.id);
    } else {
      const nouveau = await collection.create((rec: any) => Object.assign(rec, data));
      map.set(ligne.id, nouveau.id);
    }
  }

  for (const e of existants) {
    if (e.remoteId && !remoteIdsVus.has(e.remoteId)) {
      await e.destroyPermanently();
    }
  }

  return map;
}

// Remplace une table déjà synchronisée par les lignes distantes, sans erreur
// bloquante : en cas d'échec on conserve le cache local existant.
async function remplacerTable(
  nomTable: string,
  lignesDistantes: any[],
  mapper: (r: any) => any
) {
  try {
    await database.write(async () => {
      await upsertParRemoteId(nomTable, lignesDistantes, mapper);
    });
  } catch (err) {
    console.warn(`Sync : échec de restauration de "${nomTable}" (ignoré)`, err);
  }
}

async function tirerProduits(lignes: any[], produitLocal: Map<string, string>) {
  try {
    await database.write(async () => {
      const map = await upsertParRemoteId("produits", lignes, (r) => ({
        remoteId: r.id,
        userId: r.user_id,
        categorieNom: r.champs_supplementaires?.categorie_nom ?? null,
        nom: r.nom,
        prixVente: r.prix_vente,
        prixAchat: r.prix_achat,
        quantiteStock: r.quantite_stock,
        seuilAlerte: r.seuil_alerte,
        champsSupplementairesJson: JSON.stringify(r.champs_supplementaires ?? {}),
        creeLe: new Date(r.created_at),
        synchronise: true,
      }));
      map.forEach((localId, remoteId) => produitLocal.set(remoteId, localId));
    });
  } catch (err) {
    console.warn("Sync : échec de restauration des produits (ignoré)", err);
  }
}

async function tirerFournisseurs(lignes: any[]) {
  await remplacerTable("fournisseurs", lignes, (r) => ({
    remoteId: r.id,
    userId: r.user_id,
    nom: r.nom,
    telephone: r.telephone,
    adresse: r.adresse ?? null,
    totalAchats: r.total_achats,
    montantDu: r.montant_du,
    creeLe: new Date(r.created_at),
    synchronise: true,
  }));
}

async function tirerVentes(lignes: any[], produitLocal: Map<string, string>, venteLocal: Map<string, string>) {
  try {
    await database.write(async () => {
      const map = await upsertParRemoteId("ventes", lignes, (r) => ({
        remoteId: r.id,
        userId: r.user_id,
        // produit_id distant → id local (la jointure locale doit rester valide).
        produitId: r.produit_id ? produitLocal.get(r.produit_id) ?? null : null,
        produitNom: r.donnees_supplementaires?.produit_nom ?? null,
        quantite: r.quantite,
        prixUnitaire: r.prix_unitaire,
        clientNom: r.client_nom,
        clientTelephone: r.client_telephone,
        modePaiement: r.mode_paiement,
        source: r.source,
        audioUrl: r.audio_url,
        imageFactureUrl: r.image_facture_url,
        donneesSupplementairesJson: JSON.stringify(r.donnees_supplementaires ?? {}),
        creeLe: new Date(r.created_at),
        synchronise: true,
      }));
      map.forEach((localId, remoteId) => venteLocal.set(remoteId, localId));
    });
  } catch (err) {
    console.warn("Sync : échec de restauration des ventes (ignoré)", err);
  }
}

async function tirerAchats(lignes: any[]) {
  await remplacerTable("achats", lignes, (r) => ({
    remoteId: r.id,
    userId: r.user_id,
    fournisseurNom: r.fournisseur_nom,
    description: r.description,
    montant: r.montant,
    source: r.source,
    factureImageUrl: r.facture_image_url,
    donneesSupplementairesJson: JSON.stringify(r.donnees_supplementaires ?? {}),
    creeLe: new Date(r.created_at),
    synchronise: true,
  }));
}

async function tirerCreances(lignes: any[]) {
  await remplacerTable("creances_dettes", lignes, (r) => ({
    remoteId: r.id,
    userId: r.user_id,
    type: r.type,
    personneNom: r.personne_nom,
    telephone: r.telephone,
    montantInitial: r.montant_initial,
    montantRestant: r.montant_restant,
    dateEcheance: r.date_echeance,
    statut: r.statut,
    note: r.note,
    produitConcerne: r.produit_concerne,
    creeLe: new Date(r.created_at),
    synchronise: true,
  }));
}

async function tirerDepenses(lignes: any[]) {
  await remplacerTable("depenses", lignes, (r) => ({
    remoteId: r.id,
    userId: r.user_id,
    categorie: r.categorie,
    description: r.description,
    montant: r.montant,
    creeLe: new Date(r.created_at),
    synchronise: true,
  }));
}

async function tirerMouvements(lignes: any[], produitLocal: Map<string, string>) {
  try {
    await database.write(async () => {
      await upsertParRemoteId("mouvements_stock", lignes, (r) => ({
        remoteId: r.id,
        userId: r.user_id,
        produitId: r.produit_id ? produitLocal.get(r.produit_id) ?? null : null,
        type: r.type,
        quantite: r.quantite,
        stockAvant: r.stock_avant,
        stockApres: r.stock_apres,
        raison: r.raison,
        creeLe: new Date(r.created_at),
        synchronise: true,
      }));
    });
  } catch (err) {
    console.warn("Sync : échec de restauration des mouvements (ignoré)", err);
  }
}

async function tirerFactures(lignes: any[], factureLocal: Map<string, string>) {
  try {
    await database.write(async () => {
      const map = await upsertParRemoteId("factures", lignes, (r) => ({
        remoteId: r.id,
        userId: r.user_id,
        numero: r.numero,
        clientNom: r.client_nom,
        clientTelephone: r.client_telephone,
        sousTotal: r.sous_total,
        remise: r.remise,
        total: r.total,
        statut: r.statut,
        montantPaye: r.montant_paye,
        creeLe: new Date(r.created_at),
        synchronise: true,
      }));
      map.forEach((localId, remoteId) => factureLocal.set(remoteId, localId));
    });
  } catch (err) {
    console.warn("Sync : échec de restauration des factures (ignoré)", err);
  }
}

async function tirerFactureLignes(
  lignes: any[],
  factureLocal: Map<string, string>,
  venteLocal: Map<string, string>
) {
  const collection = database.get("facture_lignes");
  try {
    await database.write(async () => {
      // facture_lignes n'a pas de colonne `synchronise` : on vide tout puis on recrée.
      const existants = await collection.query().fetch();
      await Promise.all(existants.map((e: any) => e.destroyPermanently()));

      for (const r of lignes) {
        const factureIdLocal = factureLocal.get(r.facture_id);
        if (!factureIdLocal) continue; // facture absente → on saute la ligne
        await collection.create((l: any) => {
          l.remoteId = r.id;
          l.factureId = factureIdLocal;
          l.venteId = r.vente_id ? venteLocal.get(r.vente_id) ?? null : null;
          l.produitNom = r.produit_nom;
          l.quantite = r.quantite;
          l.prixUnitaire = r.prix_unitaire;
        });
      }
    });
  } catch (err) {
    console.warn("Sync : échec de restauration des lignes de facture (ignoré)", err);
  }
}

async function tirerJournal(lignes: any[]) {
  await remplacerTable("journal_activite", lignes, (r) => ({
    remoteId: r.id,
    userId: r.user_id,
    type: r.type,
    action: r.action,
    description: r.description,
    creeLe: new Date(r.created_at),
    synchronise: true,
  }));
}

// Verrou anti-concurrence : empêche deux synchronisations simultanées de
// s'entrelacer (ce qui causait des doublons de produits et l'erreur
// « Record not found »). Une seule sync à la fois.
let syncEnCours = false;

export async function synchroniserTout(userId: string) {
  if (syncEnCours) return;
  syncEnCours = true;
  setEtatSync("syncing");
  try {
    if (!(await peutSynchroniser())) {
      setEtatSync("complete");
      return;
    }
    await pousserDonneesLocales();
    await tirerDonneesDistantes(userId);
    signalerModificationDonnees();
    setEtatSync("complete");
  } catch (err) {
    setEtatSync("error");
    console.warn("Sync échouée", err);
  } finally {
    syncEnCours = false;
  }
}

// Synchro complète pour l'utilisateur courant (récupère l'id depuis la session).
// À appeler après chaque écriture pour que les lecteurs distants (dashboard,
// clients, créances…) voient immédiatement les nouvelles données.
export async function synchroniserPourUtilisateurCourant() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await synchroniserTout(user.id);
}