import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import { avecTimeout } from "@/lib/timeout";

const CLE_TOKEN = "expo_push_token";

// Enregistre le token Expo Push de l'appareil dans profiles.expo_push_token.
// C'est ce qui permet au SERVEUR (edge function + webhook sur la table
// `notifications`) d'envoyer une notification INSTANTANÉE, même app fermée —
// là où les notifications planifiées localement ne partent qu'aux heures fixes.
export async function enregistrerTokenPush() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;

    const { data: { user } } = await avecTimeout(supabase.auth.getUser(), 5000);
    if (!user) return;

    // Sans projectId, getExpoPushTokenAsync jette systématiquement hors
    // Expo Go (SDK 53+) — et le catch muet faisait qu'AUCUN token n'était
    // jamais enregistré : aucun push serveur ne partait.
    const projectId =
      Constants.easConfig?.projectId ??
      Constants.expoConfig?.extra?.eas?.projectId ??
      null;
    if (!projectId) {
      console.warn(
        "Push : aucun projectId EAS configuré (lancer `eas init` et ajouter extra.eas.projectId dans app.json) — token non enregistré."
      );
      return;
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return;

    const ancien = await AsyncStorage.getItem(CLE_TOKEN);
    if (ancien === token) return; // déjà enregistré

    const { error } = await supabase
      .from("profiles")
      .update({ expo_push_token: token })
      .eq("id", user.id);
    if (!error) await AsyncStorage.setItem(CLE_TOKEN, token);
  } catch (err) {
    // Pas de token (expo-go, émulateur, hors ligne) : on réessaiera au prochain lancement.
    console.warn("Push : échec d'enregistrement du token", err);
  }
}
