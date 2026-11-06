// Analyses « Prévisions » du Dashboard — 100 % locales (WatermelonDB),
// donc disponibles hors ligne. Chaque fonction prend les collections déjà
// chargées par l'écran et renvoie des cartes prêtes à afficher.

export type VenteLike = {
  produitId: string | null;
  produitNom: string | null;
  quantite: number;
  prixUnitaire: number;
  clientNom: string | null;
  clientTelephone: string | null;
  creeLe: Date;
};

export type ProduitLike = {
  id: string;
  nom: string;
  quantiteStock: number;
  seuilAlerte: number;
};

export type CreanceLike = {
  id: string;
  type: string;
  personneNom: string;
  telephone: string | null;
  montantRestant: number;
  dateEcheance: string | null;
  statut: string;
};

const JOUR_MS = 24 * 60 * 60 * 1000;

function debutJour(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

// ---------------------------------------------------------------------------
// 1) Analyse des baisses de ventes : produits dont les ventes de la semaine
//    chutent (> 30 %) vs la semaine précédente, avec la cause probable.
// ---------------------------------------------------------------------------

export type BaisseVente = {
  produitId: string | null;
  nom: string;
  quantiteSemaine: number;
  quantitePrecedente: number;
  variationPct: number; // négatif
  cause: "rupture" | "stock_faible" | "clients_absents" | "inconnue";
  clientsAbsents: string[];
};

export function analyserBaissesVentes(ventes: VenteLike[], produits: ProduitLike[]): BaisseVente[] {
  const maintenant = new Date();
  const debutSemaine = debutJour(new Date(maintenant.getTime() - 7 * JOUR_MS));
  const debutPrecedente = debutJour(new Date(maintenant.getTime() - 14 * JOUR_MS));

  const parProduit = new Map<string, { nom: string; courant: number; precedent: number }>();
  for (const v of ventes) {
    const cle = v.produitId ?? v.produitNom ?? "—";
    if (cle === "—") continue;
    const entree = parProduit.get(cle) ?? { nom: v.produitNom ?? cle, courant: 0, precedent: 0 };
    if (v.creeLe >= debutSemaine) entree.courant += v.quantite;
    else if (v.creeLe >= debutPrecedente) entree.precedent += v.quantite;
    parProduit.set(cle, entree);
  }

  const produitsParId = new Map(produits.map((p) => [p.id, p]));
  const resultats: BaisseVente[] = [];

  for (const [cle, d] of parProduit) {
    // Au moins 3 ventes la semaine précédente : en dessous, une « baisse »
    // n'est que du bruit.
    if (d.precedent < 3) continue;
    const variation = (d.courant - d.precedent) / d.precedent;
    if (variation > -0.3) continue;

    const produit = produitsParId.get(cle);
    let cause: BaisseVente["cause"] = "inconnue";
    let clientsAbsents: string[] = [];
    if (produit && produit.quantiteStock === 0) {
      cause = "rupture";
    } else if (produit && produit.quantiteStock <= produit.seuilAlerte) {
      cause = "stock_faible";
    } else {
      // Clients habituels de CE produit absents cette semaine.
      const acheteursRecents = new Set<string>();
      const acheteursSemaine = new Set<string>();
      for (const v of ventes) {
        if ((v.produitId ?? v.produitNom) !== cle || !v.clientNom) continue;
        if (v.creeLe >= debutSemaine) acheteursSemaine.add(v.clientNom);
        else if (v.creeLe >= new Date(maintenant.getTime() - 28 * JOUR_MS)) acheteursRecents.add(v.clientNom);
      }
      clientsAbsents = [...acheteursRecents].filter((c) => !acheteursSemaine.has(c)).slice(0, 3);
      if (clientsAbsents.length > 0) cause = "clients_absents";
    }

    resultats.push({
      produitId: produit?.id ?? null,
      nom: d.nom,
      quantiteSemaine: d.courant,
      quantitePrecedente: d.precedent,
      variationPct: Math.round(variation * 100),
      cause,
      clientsAbsents,
    });
  }

  return resultats.sort((a, b) => a.variationPct - b.variationPct).slice(0, 5);
}

// ---------------------------------------------------------------------------
// 2) Smart Follow-up : clients dont le cycle d'achat habituel est dépassé.
// ---------------------------------------------------------------------------

export type RelanceClient = {
  nom: string;
  telephone: string | null;
  cycleJours: number;
  joursDepuisDernier: number;
};

export function analyserRelancesClients(ventes: VenteLike[]): RelanceClient[] {
  const maintenant = Date.now();
  const parClient = new Map<string, { telephone: string | null; dates: number[] }>();

  for (const v of ventes) {
    if (!v.clientNom) continue;
    const entree = parClient.get(v.clientNom) ?? { telephone: v.clientTelephone, dates: [] };
    if (v.clientTelephone) entree.telephone = v.clientTelephone;
    entree.dates.push(v.creeLe.getTime());
    parClient.set(v.clientNom, entree);
  }

  const resultats: RelanceClient[] = [];
  for (const [nom, c] of parClient) {
    // Il faut au moins 3 visites pour parler de « cycle habituel ».
    if (c.dates.length < 3) continue;
    const dates = [...new Set(c.dates.map((t) => debutJour(new Date(t)).getTime()))].sort((a, b) => a - b);
    if (dates.length < 3) continue;

    const intervalles: number[] = [];
    for (let i = 1; i < dates.length; i++) intervalles.push((dates[i] - dates[i - 1]) / JOUR_MS);
    const cycle = intervalles.reduce((s, i) => s + i, 0) / intervalles.length;
    if (cycle < 2) continue; // client quasi quotidien : pas de relance utile

    const joursDepuis = Math.floor((maintenant - dates[dates.length - 1]) / JOUR_MS);
    // Dépassement net du cycle habituel (marge de 30 %).
    if (joursDepuis > cycle * 1.3) {
      resultats.push({ nom, telephone: c.telephone, cycleJours: Math.round(cycle), joursDepuisDernier: joursDepuis });
    }
  }

  return resultats.sort((a, b) => b.joursDepuisDernier - a.joursDepuisDernier).slice(0, 5);
}

// ---------------------------------------------------------------------------
// 3) Prévision de stock : demande en hausse + stock en baisse → rupture
//    probable, avec quantité de réapprovisionnement recommandée.
// ---------------------------------------------------------------------------

export type PrevisionStock = {
  produitId: string;
  nom: string;
  stockActuel: number;
  vitesseJour: number; // unités / jour (30 jours)
  joursRestants: number;
  quantiteRecommandee: number;
};

export function analyserPrevisionsStock(ventes: VenteLike[], produits: ProduitLike[]): PrevisionStock[] {
  const maintenant = new Date();
  const debut30 = debutJour(new Date(maintenant.getTime() - 30 * JOUR_MS));
  const debut15 = debutJour(new Date(maintenant.getTime() - 15 * JOUR_MS));

  const parProduit = new Map<string, { quinzaine1: number; quinzaine2: number }>();
  for (const v of ventes) {
    if (!v.produitId || v.creeLe < debut30) continue;
    const entree = parProduit.get(v.produitId) ?? { quinzaine1: 0, quinzaine2: 0 };
    if (v.creeLe >= debut15) entree.quinzaine2 += v.quantite;
    else entree.quinzaine1 += v.quantite;
    parProduit.set(v.produitId, entree);
  }

  const resultats: PrevisionStock[] = [];
  for (const p of produits) {
    const d = parProduit.get(p.id);
    if (!d) continue;
    const total30 = d.quinzaine1 + d.quinzaine2;
    if (total30 < 3) continue; // pas assez d'historique pour projeter
    const vitesse = total30 / 30;
    // Demande en HAUSSE : la 2e quinzaine dépasse nettement la 1re.
    if (d.quinzaine2 <= d.quinzaine1 * 1.2) continue;
    const joursRestants = Math.floor(p.quantiteStock / vitesse);
    // Le stock ne couvre pas la semaine à venir → alerte.
    if (joursRestants >= 7) continue;
    resultats.push({
      produitId: p.id,
      nom: p.nom,
      stockActuel: p.quantiteStock,
      vitesseJour: Math.round(vitesse * 10) / 10,
      joursRestants,
      // Objectif : 14 jours de couverture.
      quantiteRecommandee: Math.max(1, Math.ceil(vitesse * 14 - p.quantiteStock)),
    });
  }

  return resultats.sort((a, b) => a.joursRestants - b.joursRestants).slice(0, 5);
}

// ---------------------------------------------------------------------------
// 4) Morning Brief : le résumé du matin (notification + carte de l'onglet).
// ---------------------------------------------------------------------------

export type MorningBrief = {
  nbRisquesRupture: number; // stock faible + ruptures + prévisions
  nomsRisques: string[];
  creancesEcheance: { nom: string; montant: number; dansJours: number }[];
  caHier: number;
  caMoyenne7Jours: number;
  variationHierPct: number | null; // null si moyenne nulle
  priorite: { type: "stock" | "creance" | "ventes" | "calme"; libelle: string };
};

export function construireMorningBrief(ventes: VenteLike[], produits: ProduitLike[], creances: CreanceLike[]): MorningBrief {
  const maintenant = new Date();
  const debutAujourdhui = debutJour(maintenant);
  const debutHier = new Date(debutAujourdhui.getTime() - JOUR_MS);
  const debut7Jours = new Date(debutAujourdhui.getTime() - 7 * JOUR_MS);

  // Produits à risque : rupture, stock faible ou rupture prévue < 7 jours.
  const risques = produits.filter((p) => p.quantiteStock <= p.seuilAlerte);
  const nomsPrevisions = new Set(analyserPrevisionsStock(ventes, produits).map((p) => p.nom));
  const nomsRisques = [...new Set([...risques.map((p) => p.nom), ...nomsPrevisions])].slice(0, 5);

  // Créances dont l'échéance tombe sous 3 jours (ou déjà dépassée).
  const limite = new Date(debutAujourdhui.getTime() + 3 * JOUR_MS);
  const creancesEcheance = creances
    .filter((c) => c.type === "creance" && c.statut !== "payee" && c.dateEcheance)
    .map((c) => {
      const ech = debutJour(new Date(c.dateEcheance!));
      return { nom: c.personneNom, montant: c.montantRestant, ech };
    })
    .filter((c) => c.ech <= limite)
    .sort((a, b) => a.ech.getTime() - b.ech.getTime())
    .slice(0, 5)
    .map((c) => ({ nom: c.nom, montant: c.montant, dansJours: Math.round((c.ech.getTime() - debutAujourdhui.getTime()) / JOUR_MS) }));

  // Ventes d'hier vs moyenne des 7 derniers jours.
  const caHier = ventes.filter((v) => v.creeLe >= debutHier && v.creeLe < debutAujourdhui).reduce((s, v) => s + v.quantite * v.prixUnitaire, 0);
  const ca7 = ventes.filter((v) => v.creeLe >= debut7Jours && v.creeLe < debutAujourdhui).reduce((s, v) => s + v.quantite * v.prixUnitaire, 0);
  const caMoyenne = ca7 / 7;
  const variation = caMoyenne > 0 ? Math.round(((caHier - caMoyenne) / caMoyenne) * 100) : null;

  // Priorité du jour : la première urgence dans l'ordre stock → créances → ventes.
  let priorite: MorningBrief["priorite"];
  if (nomsRisques.length > 0) priorite = { type: "stock", libelle: nomsRisques[0] };
  else if (creancesEcheance.length > 0) priorite = { type: "creance", libelle: creancesEcheance[0].nom };
  else if (variation !== null && variation < -20) priorite = { type: "ventes", libelle: "" };
  else priorite = { type: "calme", libelle: "" };

  return {
    nbRisquesRupture: nomsRisques.length,
    nomsRisques,
    creancesEcheance,
    caHier,
    caMoyenne7Jours: Math.round(caMoyenne),
    variationHierPct: variation,
    priorite,
  };
}
