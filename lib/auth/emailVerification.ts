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
    const { error: majError } = await supabase.from("profiles").update({ is_verified: true }).eq("id", user.id);
    if (majError) {
      console.warn("Échec update is_verified :", majError.message);
    }
  }
  await AsyncStorage.removeItem(CLE_EMAIL_EN_ATTENTE);
  return { error: null };
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