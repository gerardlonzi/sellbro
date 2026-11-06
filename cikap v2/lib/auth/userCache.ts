import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import { avecTimeout } from "@/lib/timeout";

const CLE = "boutika_user_id";

// getSession() lit le token stocké localement, SANS appel réseau —
// contrairement à getUser() qui vérifie le token auprès du serveur.
// MAIS avec autoRefreshToken, un token expiré déclenche un refresh réseau qui
// peut rester PENDU hors ligne et bloquer l'affichage de toute l'app — d'où le
// timeout court : hors ligne, on retombe immédiatement sur l'id en cache.
export async function obtenirUserId(): Promise<string | null> {
  try {
    const { data } = await avecTimeout(supabase.auth.getSession(), 3000);
    if (data.session?.user.id) {
      await AsyncStorage.setItem(CLE, data.session.user.id);
      return data.session.user.id;
    }
  } catch {
    // Hors ligne / refresh pendu : on utilise le dernier id connu.
  }
  return AsyncStorage.getItem(CLE);
}
