import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";

const CLE = "boutika_user_id";

// getSession() lit le token stocké localement, SANS appel réseau —
// contrairement à getUser() qui vérifie le token auprès du serveur.
export async function obtenirUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id) {
    await AsyncStorage.setItem(CLE, data.session.user.id);
    return data.session.user.id;
  }
  return AsyncStorage.getItem(CLE); // dernier recours si getSession échoue aussi
}