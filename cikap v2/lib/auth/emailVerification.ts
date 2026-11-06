import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";

// Clé locale qui mémorise qu'une vérification d'email est en attente.
// C'est ce qui permet, au redémarrage, de rediriger de force vers l'écran
// de saisie du code tant que l'email n'est pas vérifié (avant vérification,
// il n'y a pas encore de session, donc pas moyen de lire profiles.is_verified).
export const CLE_EMAIL_EN_ATTENTE = "boutika_email_en_attente";

// 1. Envoie le code OTP. signInWithOtp crée immédiatement l'utilisateur auth
//    (si absent) et le trigger SQL crée aussitôt la ligne profiles associée
//    avec is_verified = false. On mémorise l'email en attente côté appareil.
export async function envoyerCodeEmail(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (!error) {
    await AsyncStorage.setItem(CLE_EMAIL_EN_ATTENTE, email);
    await AsyncStorage.setItem("boutika_email", email);
  }
  return { error };
}

// 2. Vérifie le code reçu et ne fait QUE passer is_verified à true.
//    Les infos du profil (nom, téléphone, langue, devise, pays) ont déjà été
//    sauvegardées à l'inscription, via la fonction SQL security definer
//    `sauvegarder_profil_inscription`.
export async function verifierCodeEmail(email: string, code: string) {
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) return { error };

  // On utilise directement le user retourné par verifyOtp (getUser() peut
  // renvoyer null à cause d'une course de timing sur la session).
  const user = data.user;
  if (user) {
    // On a maintenant une session : on réécrit le profil (nom boutique,
    // téléphone, langue, devise, pays) à partir des valeurs saisies à
    // l'inscription. C'est le filet de sécurité si l'appel RPC fait AVANT la
    // vérification (sans session) avait échoué — le compte n'est plus jamais
    // créé « vide ».
    await reecrireProfilApresVerification(user.id);
  }
  await AsyncStorage.removeItem(CLE_EMAIL_EN_ATTENTE);
  return { error: null };
}

// Réécrit les infos du profil depuis les valeurs stockées localement à
// l'inscription. À appeler UNIQUEMENT quand une session existe (après OTP).
// On UPSERT (et non un simple UPDATE) : si le trigger `on_auth_user_created`
// n'a pas tourné, la ligne profiles n'existe pas encore — l'UPDATE matcherait
// 0 ligne silencieusement et le compte resterait absent de la base.
async function reecrireProfilApresVerification(userId: string) {
  try {
    const [nomBoutique, telephone, langue, devise, paysCode, email] = await Promise.all([
      AsyncStorage.getItem("boutika_nom_boutique"),
      AsyncStorage.getItem("boutika_telephone"),
      AsyncStorage.getItem("boutika_langue"),
      AsyncStorage.getItem("boutika_devise"),
      AsyncStorage.getItem("boutika_pays"),
      AsyncStorage.getItem("boutika_email"),
    ]);
    const patch: Record<string, unknown> = { id: userId, is_verified: true };
    if (email) patch.email = email;
    if (nomBoutique) patch.nom_boutique = nomBoutique;
    if (telephone) patch.telephone = telephone;
    if (langue) patch.langue = langue;
    if (devise) patch.devise = devise;
    if (paysCode) patch.pays_code = paysCode;
    const { error } = await supabase.from("profiles").upsert(patch, { onConflict: "id" });
    if (error) console.warn("Échec sauvegarde profil après vérification :", error.message);
  } catch (e) {
    console.warn("Échec sauvegarde profil après vérification :", e);
  }
}

// 3. Change l'email sans créer de doublon : envoie un nouveau code sur le
//    nouvel email, met à jour l'email en attente, et supprime l'ancien profil
//    non vérifié (via une fonction SQL security definer) pour ne pas laisser
//    une ligne orpheline dans profiles.
export async function changerEmail(ancienEmail: string, nouvelEmail: string) {
  const { error } = await supabase.auth.signInWithOtp({ email: nouvelEmail });
  if (!error) {
    await AsyncStorage.setItem(CLE_EMAIL_EN_ATTENTE, nouvelEmail);
    await AsyncStorage.setItem("boutika_email", nouvelEmail);
    await supabase.rpc("supprimer_profil_non_verifie", { p_email: ancienEmail });
  }
  return { error };
}