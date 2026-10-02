import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { obtenirUserId } from "@/lib/auth/userCache";
import { parserDateSeule } from "@/lib/formatDate";
import { supabase } from "@/lib/supabase/client";
import { avecTimeout } from "@/lib/timeout";
import { t, Langue, detecterLangueSysteme } from "@/lib/i18n";
import { DEVISES } from "@/lib/currency/CurrencyProvider";
import { convertirDepuisFcfa } from "@/lib/currency/taux";

// Langue choisie dans l'app (pas celle du téléphone) : les notifications
// planifiées sont générées en dehors de React, on lit donc le stockage local.
async function langueUtilisateur(): Promise<Langue> {
  try {
    const l = await AsyncStorage.getItem("boutika_langue");
    if (l === "fr" || l === "en") return l;
  } catch {}
  return detecterLangueSysteme();
}

// Devise choisie dans l'app : même raisonnement que la langue, les montants
// des notifications doivent respecter ce choix (pas un symbole codé en dur).
async function formaterMontantNotif(montantFcfa: number): Promise<string> {
  try {
    const code = await AsyncStorage.getItem("boutika_devise");
    const devise = DEVISES.find((d) => d.code === code) ?? DEVISES[0];
    return `${convertirDepuisFcfa(montantFcfa, devise.code).toLocaleString()} ${devise.symbole}`;
  } catch {
    return `${montantFcfa.toLocaleString()} FCFA`;
  }
}

// Configure le comportement des notifications affichées (même en avant-plan).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Clés des interrupteurs (Paramètres → Notifications).
const CLE_STOCK_FAIBLE = "notif_stock_faible_active";
const CLE_CRANCE_RETARD = "notif_creance_retard_active";

// Heures de rappel CHOISIES par l'utilisateur (Paramètres → Notifications).
// Défaut : 3 rappels par jour (9h, 13h, 18h).
export const CLE_HEURES_NOTIF = "notif_heures_rappel";
const HEURES_DEFAUT = [9, 13, 18];

export async function lireHeuresRappel(): Promise<number[]> {
  try {
    const brut = await AsyncStorage.getItem(CLE_HEURES_NOTIF);
    if (brut) {
      const heures = (JSON.parse(brut) as number[]).filter((h) => Number.isInteger(h) && h >= 0 && h <= 23);
      if (heures.length > 0) return heures.sort((a, b) => a - b);
    }
  } catch {}
  return HEURES_DEFAUT;
}

async function estActive(cle: string): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(cle);
    return v !== "false"; // active par défaut
  } catch {
    return true;
  }
}

// Demande la permission et crée le canal Android.
export async function configurerNotifications() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("alertes", {
      name: "Alertes",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#25af93",
    });
  }

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    await Notifications.requestPermissionsAsync();
  }
}

export type ProduitAlerte = { id: string; nom: string; quantite: number; seuil: number };
export type CreanceAlerte = { id: string; nom: string; montant: number; dateEcheance: string | null };

// Scan la base locale : produits en RUPTURE (stock = 0), en stock FAIBLE
// (0 < stock ≤ seuil) + créances en retard (avec le détail des noms).
export async function detecterAlertes() {
  const userId = await obtenirUserId();
  if (!userId) {
    return { nbRuptures: 0, nbRetards: 0, produitsRupture: [] as ProduitAlerte[], produitsFaibles: [] as ProduitAlerte[], creancesRetard: [] as CreanceAlerte[] };
  }

  const produits = await database.get("produits").query(Q.where("user_id", userId)).fetch();
  const produitsRupture: ProduitAlerte[] = (produits as any[])
    .filter((p) => p.quantiteStock === 0)
    .map((p) => ({ id: p.id, nom: p.nom, quantite: p.quantiteStock, seuil: p.seuilAlerte }));
  const produitsFaibles: ProduitAlerte[] = (produits as any[])
    .filter((p) => p.quantiteStock > 0 && p.quantiteStock <= p.seuilAlerte)
    .map((p) => ({ id: p.id, nom: p.nom, quantite: p.quantiteStock, seuil: p.seuilAlerte }));

  const creances = await database.get("creances_dettes").query(Q.where("user_id", userId)).fetch();
  const creancesRetard: CreanceAlerte[] = (creances as any[])
    .filter((c) => c.statut !== "payee" && c.dateEcheance && parserDateSeule(c.dateEcheance) < new Date())
    .map((c) => ({ id: c.id, nom: c.personneNom, montant: c.montantRestant, dateEcheance: c.dateEcheance }));

  return {
    nbRuptures: produitsRupture.length + produitsFaibles.length,
    nbRetards: creancesRetard.length,
    produitsRupture,
    produitsFaibles,
    creancesRetard,
  };
}

// Persiste les alertes (rupture + stock faible + créances en retard) dans la
// table `notifications` Supabase, avec déduplication STRICTE : une alerte
// n'existe qu'EN UN SEUL EXEMPLAIRE (lue ou non) tant que le problème est
// présent. Quand le problème disparaît (produit réapprovisionné, créance
// payée), l'alerte est supprimée — elle pourra revenir si le problème revient.
async function persisterAlertes(produitsRupture: ProduitAlerte[], produitsFaibles: ProduitAlerte[], creancesRetard: CreanceAlerte[]) {
  const userId = await obtenirUserId();
  if (!userId) return;

  try {
    const TYPES = ["rupture_stock", "stock_faible", "creance_retard"];
    const { data: existantes } = await supabase
      .from("notifications")
      .select("id, type, lien")
      .eq("user_id", userId)
      .in("type", TYPES);

    // Alertes actuellement justifiées : type|lien → message (nom).
    const actuelles = new Map<string, string>();
    for (const p of produitsRupture) actuelles.set(`rupture_stock|/produit/${p.id}`, p.nom);
    for (const p of produitsFaibles) actuelles.set(`stock_faible|/produit/${p.id}`, p.nom);
    for (const c of creancesRetard) actuelles.set(`creance_retard|/creances/${c.id}`, c.nom);

    const dejaPresentes = new Set((existantes ?? []).map((n: any) => `${n.type}|${n.lien}`));

    // 1) Résolution : supprime les alertes dont le problème a disparu
    //    (et les doublons éventuels déjà présents en base).
    const vus = new Set<string>();
    const aSupprimer: string[] = [];
    for (const n of existantes ?? []) {
      const cle = `${n.type}|${n.lien}`;
      if (!actuelles.has(cle) || vus.has(cle)) aSupprimer.push(n.id);
      else vus.add(cle);
    }
    if (aSupprimer.length > 0) {
      await supabase.from("notifications").delete().in("id", aSupprimer);
    }

    // 2) Insertion : uniquement les alertes absentes (peu importe lu/non-lu).
    const aInserer: any[] = [];
    for (const [cle, nom] of actuelles) {
      if (dejaPresentes.has(cle)) continue;
      const [type, lien] = cle.split("|");
      aInserer.push({ user_id: userId, type, message: nom, lien, lu: false });
    }
    if (aInserer.length > 0) {
      await supabase.from("notifications").insert(aInserer);
    }
  } catch {
    // Hors ligne / erreur réseau : on ignore, les alertes seront persistées plus tard.
  }
}

// ---------------------------------------------------------------------------
// Liste des notifications AVEC repli hors ligne.
// En ligne : lecture Supabase, mise en cache local.
// Hors ligne : cache de la dernière lecture + alertes détectées localement
// (ruptures, stock faible, créances en retard), avec état lu/non-lu local.
// ---------------------------------------------------------------------------

const CLE_CACHE_NOTIFS = "notifications_cache";
const CLE_LUES_LOCALES = "notifications_lues_locales";

export type NotificationItem = {
  id: string;
  type: string;
  message: string;
  lu: boolean;
  created_at: string;
  lien?: string | null;
};

async function lireLuesLocales(): Promise<Set<string>> {
  try {
    const brut = await AsyncStorage.getItem(CLE_LUES_LOCALES);
    return new Set(brut ? (JSON.parse(brut) as string[]) : []);
  } catch {
    return new Set();
  }
}

// Mémorise le « lu » localement pour qu'il survive au mode hors ligne.
export async function marquerLueLocale(id: string) {
  try {
    const lues = await lireLuesLocales();
    lues.add(id);
    await AsyncStorage.setItem(CLE_LUES_LOCALES, JSON.stringify([...lues]));
  } catch {}
}

// Construit des notifications synthétiques depuis la base locale (WatermelonDB),
// sans doublon avec celles déjà présentes dans le cache.
function alertesLocales(
  detectees: Awaited<ReturnType<typeof detecterAlertes>>,
  dejaPresentes: Set<string>
): NotificationItem[] {
  const maintenant = new Date().toISOString();
  const locales: NotificationItem[] = [];
  for (const p of detectees.produitsRupture) {
    const lien = `/produit/${p.id}`;
    if (!dejaPresentes.has(`rupture_stock|${lien}`)) {
      locales.push({ id: `local|rupture_stock|${p.id}`, type: "rupture_stock", message: p.nom, lu: false, created_at: maintenant, lien });
    }
  }
  for (const p of detectees.produitsFaibles) {
    const lien = `/produit/${p.id}`;
    if (!dejaPresentes.has(`stock_faible|${lien}`)) {
      locales.push({ id: `local|stock_faible|${p.id}`, type: "stock_faible", message: p.nom, lu: false, created_at: maintenant, lien });
    }
  }
  for (const c of detectees.creancesRetard) {
    const lien = `/creances/${c.id}`;
    if (!dejaPresentes.has(`creance_retard|${lien}`)) {
      locales.push({ id: `local|creance_retard|${c.id}`, type: "creance_retard", message: c.nom, lu: false, created_at: maintenant, lien });
    }
  }
  return locales;
}

export async function chargerNotifications(): Promise<NotificationItem[]> {
  const lues = await lireLuesLocales();

  // En ligne : Supabase, puis mise en cache.
  try {
    const { data, error } = await avecTimeout(
      supabase.from("notifications").select("*").order("created_at", { ascending: false }),
      6000
    );
    if (!error && data) {
      await AsyncStorage.setItem(CLE_CACHE_NOTIFS, JSON.stringify(data));
      return (data as NotificationItem[]).map((n) => ({ ...n, lu: n.lu || lues.has(n.id) }));
    }
  } catch {
    // Hors ligne : repli ci-dessous.
  }

  // Hors ligne : cache de la dernière lecture + alertes locales détectées.
  let cache: NotificationItem[] = [];
  try {
    cache = JSON.parse((await AsyncStorage.getItem(CLE_CACHE_NOTIFS)) ?? "[]");
  } catch {}

  const detectees = await detecterAlertes();
  const dejaPresentes = new Set(cache.map((n) => `${n.type}|${n.lien}`));
  const locales = alertesLocales(detectees, dejaPresentes);

  return [...locales, ...cache].map((n) => ({ ...n, lu: n.lu || lues.has(n.id) }));
}

// Nombre de non-lues pour le badge cloche (fonctionne hors ligne).
export async function nombreNotificationsNonLues(): Promise<number> {
  const liste = await chargerNotifications();
  return liste.filter((n) => !n.lu).length;
}

// Vérifie les alertes et planifie jusqu'à 3 notifications locales par jour
// (9h, 13h, 18h). Une notification PLANIFIÉE est délivrée par le système même
// si l'app est fermée — c'est ce qui permet l'alerte hors ligne.
export async function verifierAlertesEtNotifier() {
  await configurerNotifications();
  const { produitsRupture, produitsFaibles, creancesRetard } = await detecterAlertes();

  // Respecte les interrupteurs de Paramètres → Notifications.
  const [stockActive, creanceActive] = await Promise.all([
    estActive(CLE_STOCK_FAIBLE),
    estActive(CLE_CRANCE_RETARD),
  ]);

  // Persiste les alertes dans la table notifications (dates réelles + lu/non-lu).
  await persisterAlertes(produitsRupture, produitsFaibles, creancesRetard);

  // On repart de zéro pour que le contenu reste à jour.
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Textes dans la langue choisie par l'utilisateur dans l'app.
  const langue = await langueUtilisateur();

  const messages: string[] = [];
  if (stockActive && produitsFaibles.length > 0) {
    const apercu = produitsFaibles.slice(0, 3).map((p) => `${p.nom} (${p.quantite})`).join(", ");
    messages.push(
      `${t("notif_msg_stock_faible", langue)(produitsFaibles.length, apercu)}${produitsFaibles.length > 3 ? "…" : ""}`
    );
  }
  if (creanceActive && creancesRetard.length > 0) {
    const montants = await Promise.all(creancesRetard.slice(0, 3).map((c) => formaterMontantNotif(c.montant)));
    const apercu = creancesRetard.slice(0, 3).map((c, i) => `${c.nom} (${montants[i]})`).join(", ");
    messages.push(
      `${t("notif_msg_creance_retard", langue)(creancesRetard.length, apercu)}${creancesRetard.length > 3 ? "…" : ""}`
    );
  }

  if (messages.length === 0) return;

  // Rappels quotidiens aux heures CHOISIES par l'utilisateur (défaut : 9h,
  // 13h, 18h). Planifiés localement, donc délivrés par le système même si
  // l'app est fermée.
  const heures = await lireHeuresRappel();
  for (const heure of heures) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t("notif_alertes_titre", langue),
        body: messages.join("\n"),
        sound: true,
        data: { ecran: "/notifications" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: heure,
        minute: 0,
      },
    });
  }
}