import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { obtenirUserId } from "@/lib/auth/userCache";
import { parserDateSeule } from "@/lib/formatDate";

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

// Scan la base locale : produits en rupture/stock faible + créances en retard
// (avec le détail des noms/montants pour un contenu de notification riche).
export async function detecterAlertes() {
  const userId = await obtenirUserId();
  if (!userId) {
    return { nbRuptures: 0, nbRetards: 0, produitsFaibles: [] as ProduitAlerte[], creancesRetard: [] as CreanceAlerte[] };
  }

  const produits = await database.get("produits").query(Q.where("user_id", userId)).fetch();
  const produitsFaibles: ProduitAlerte[] = (produits as any[])
    .filter((p) => p.quantiteStock <= p.seuilAlerte)
    .map((p) => ({ id: p.id, nom: p.nom, quantite: p.quantiteStock, seuil: p.seuilAlerte }));

  const creances = await database.get("creances_dettes").query(Q.where("user_id", userId)).fetch();
  const creancesRetard: CreanceAlerte[] = (creances as any[])
    .filter((c) => c.statut !== "payee" && c.dateEcheance && parserDateSeule(c.dateEcheance) < new Date())
    .map((c) => ({ id: c.id, nom: c.personneNom, montant: c.montantRestant, dateEcheance: c.dateEcheance }));

  return {
    nbRuptures: produitsFaibles.length,
    nbRetards: creancesRetard.length,
    produitsFaibles,
    creancesRetard,
  };
}

// Vérifie les alertes et planifie jusqu'à 3 notifications locales par jour
// (9h, 13h, 18h). Une notification PLANIFIÉE est délivrée par le système même
// si l'app est fermée — c'est ce qui permet l'alerte hors ligne.
export async function verifierAlertesEtNotifier() {
  await configurerNotifications();
  const { produitsFaibles, creancesRetard } = await detecterAlertes();

  // Respecte les interrupteurs de Paramètres → Notifications.
  const [stockActive, creanceActive] = await Promise.all([
    estActive(CLE_STOCK_FAIBLE),
    estActive(CLE_CRANCE_RETARD),
  ]);

  // On repart de zéro pour que le contenu reste à jour.
  await Notifications.cancelAllScheduledNotificationsAsync();

  const messages: string[] = [];
  if (stockActive && produitsFaibles.length > 0) {
    const apercu = produitsFaibles.slice(0, 3).map((p) => `${p.nom} (${p.quantite})`).join(", ");
    messages.push(
      `${produitsFaibles.length} produit(s) en stock faible : ${apercu}${produitsFaibles.length > 3 ? "…" : ""}`
    );
  }
  if (creanceActive && creancesRetard.length > 0) {
    const apercu = creancesRetard.slice(0, 3).map((c) => `${c.nom} (${c.montant} F)`).join(", ");
    messages.push(
      `${creancesRetard.length} créance(s) en retard : ${apercu}${creancesRetard.length > 3 ? "…" : ""}`
    );
  }

  if (messages.length === 0) return;

  // Trois rappels quotidiens (matin, midi, fin d'après-midi).
  for (const heure of [9, 13, 18]) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Cikap — Alertes",
        body: messages.join("\n"),
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: heure,
        minute: 0,
      },
    });
  }
}