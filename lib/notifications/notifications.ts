import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { obtenirUserId } from "@/lib/auth/userCache";

// Configure le comportement des notifications affichées (même en avant-plan).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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

// Scan la base locale : produits en rupture/stock faible + créances en retard.
async function detecterAlertes() {
  const userId = await obtenirUserId();
  if (!userId) return { nbRuptures: 0, nbRetards: 0 };

  const produits = await database.get("produits").query(Q.where("user_id", userId)).fetch();
  const nbRuptures = (produits as any[]).filter((p) => p.quantiteStock <= p.seuilAlerte).length;

  const creances = await database.get("creances_dettes").query(Q.where("user_id", userId)).fetch();
  const nbRetards = (creances as any[]).filter(
    (c) => c.statut !== "payee" && c.dateEcheance && new Date(c.dateEcheance) < new Date()
  ).length;

  return { nbRuptures, nbRetards };
}

// Vérifie les alertes et planifie une notification locale quotidienne (9h)
// si besoin. Une notification PLANIFIÉE est délivrée par le système même si
// l'app est fermée — c'est ce qui permet l'alerte hors ligne.
export async function verifierAlertesEtNotifier() {
  await configurerNotifications();
  const { nbRuptures, nbRetards } = await detecterAlertes();

  // On repart de zéro pour que le contenu reste à jour.
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (nbRuptures === 0 && nbRetards === 0) return;

  const messages: string[] = [];
  if (nbRuptures > 0) messages.push(`${nbRuptures} produit(s) en stock faible ou rupture`);
  if (nbRetards > 0) messages.push(`${nbRetards} créance(s) ou dette(s) en retard`);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "CIKAP — Alertes",
      body: messages.join("\n"),
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 9,
      minute: 0,
    },
  });
}