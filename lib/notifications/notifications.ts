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

// Langue choisie dans l'app (pas celle du téléphone) : les notifications
// planifiées sont générées en dehors de React, on lit donc le stockage local.
async function langueUtilisateur(): Promise<Langue> {
  try {
    const l = await AsyncStorage.getItem("boutika_langue");
    if (l === "fr" || l === "en") return l;
  } catch {}
  return detecterLangueSysteme();
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
const CLE_ECHEANCE_PROCHE = "notif_echeance_proche_active";

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
// table `notifications` Supabase, avec déduplication : chaque alerte n'est
// insérée qu'une seule fois (par type + lien), tant qu'elle n'a pas été lue.
async function persisterAlertes(produitsRupture: ProduitAlerte[], produitsFaibles: ProduitAlerte[], creancesRetard: CreanceAlerte[]) {
  const userId = await obtenirUserId();
  if (!userId) return;

  try {
    const { data: existantes } = await supabase
      .from("notifications")
      .select("type, lien")
      .eq("user_id", userId)
      .eq("lu", false);

    const dejaPresentes = new Set((existantes ?? []).map((n: any) => `${n.type}|${n.lien}`));

    const aInserer: any[] = [];
    // On stocke uniquement le NOM de l'item dans `message` ; le préfixe
    // localisé est ajouté à l'affichage selon la langue de l'utilisateur.
    for (const p of produitsRupture) {
      const lien = `/produit/${p.id}`;
      if (!dejaPresentes.has(`rupture_stock|${lien}`)) {
        aInserer.push({ user_id: userId, type: "rupture_stock", message: p.nom, lien, lu: false });
      }
    }
    for (const p of produitsFaibles) {
      const lien = `/produit/${p.id}`;
      if (!dejaPresentes.has(`stock_faible|${lien}`)) {
        aInserer.push({ user_id: userId, type: "stock_faible", message: p.nom, lien, lu: false });
      }
    }
    for (const c of creancesRetard) {
      const lien = `/creances/${c.id}`;
      if (!dejaPresentes.has(`creance_retard|${lien}`)) {
        aInserer.push({ user_id: userId, type: "creance_retard", message: c.nom, lien, lu: false });
      }
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
    const apercu = creancesRetard.slice(0, 3).map((c) => `${c.nom} (${c.montant} F)`).join(", ");
    messages.push(
      `${t("notif_msg_creance_retard", langue)(creancesRetard.length, apercu)}${creancesRetard.length > 3 ? "…" : ""}`
    );
  }

  if (messages.length === 0) return;

  // Six rappels quotidiens : 8h, 10h, 12h, 14h, 16h, 18h. Planifiés localement,
  // donc délivrés par le système même si l'app est fermée.
  for (const heure of [8, 10, 12, 14, 16, 18, 20]) {
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