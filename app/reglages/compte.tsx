import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useToast } from "@/lib/toast/ToastProvider";
import { Carte, EnteteEcran } from "@/components/UI";
import { PuceIcone } from "@/components/PuceIcone";
import { supabase } from "@/lib/supabase/client";
import { database } from "@/lib/database";
import { avecTimeout } from "@/lib/timeout";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useConnexion } from "@/lib/useConnexion";

// L'email vient de getUser() (réseau) : on le met en cache pour l'afficher
// aussi hors ligne.
const CLE_EMAIL = "boutika_user_email";

// Suppression de compte : l'utilisateur efface TOUTES ses données.
// La séquence tente d'abord l'Edge Function `supprimer-compte` (qui efface
// aussi l'identité de connexion), et retombe sur la RPC `supprimer_mon_compte`
// (données seules) si la fonction n'est pas déployée. Dans les deux cas, les
// données métier disparaissent.
export default function Compte() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { showToast } = useToast();

  const [email, setEmail] = useState<string>("");
  const [motSaisi, setMotSaisi] = useState("");
  const [enCours, setEnCours] = useState(false);
  const enLigne = useConnexion();

  const motRequis = t("compte_supprimer_mot", langue);

  useEffect(() => {
    // Cache local d'abord : l'email s'affiche immédiatement, même hors ligne.
    AsyncStorage.getItem(CLE_EMAIL).then((cache) => {
      if (cache) setEmail(cache);
    });
    // getUser() est un appel RÉSEAU : timeout court, sinon l'écran reste vide
    // hors ligne. En cas de succès, on rafraîchit le cache.
    avecTimeout(supabase.auth.getUser(), 4000)
      .then(({ data }) => {
        if (data.user?.email) {
          setEmail(data.user.email);
          AsyncStorage.setItem(CLE_EMAIL, data.user.email).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  // Le bouton n'est actif qu'une fois le mot-clé recopié exactement, et
  // uniquement EN LIGNE : impossible de supprimer un compte sans connexion.
  const pret = motSaisi.trim().toUpperCase() === motRequis.toUpperCase() && !enCours && enLigne;

  function confirmer() {
    if (!pret) return;
    Alert.alert(
      t("compte_supprimer_confirmation_titre", langue),
      t("compte_supprimer_confirmation_texte", langue),
      [
        { text: t("compte_supprimer_annuler", langue), style: "cancel" },
        { text: t("compte_supprimer_bouton", langue), style: "destructive", onPress: executer },
      ]
    );
  }

  async function executer() {
    // Double protection : même si l'état du bouton est contourné, jamais de
    // suppression sans connexion.
    if (enCours || !enLigne) return;
    setEnCours(true);
    try {
      // 1) Edge Function : efface aussi l'identité de connexion (auth.users).
      let serveurPurge = false;
      try {
        const { error } = await avecTimeout(supabase.functions.invoke("supprimer-compte"), 15000);
        serveurPurge = !error;
      } catch {
        // Fonction non déployée ou réseau : on bascule sur la RPC ci-dessous.
      }

      // 2) Repli : la RPC supprime le profil, donc toutes les données métier
      //    (ON DELETE CASCADE sur chaque table), mais pas l'identité de connexion.
      if (!serveurPurge) {
        const { error } = await avecTimeout(supabase.rpc("supprimer_mon_compte"), 15000);
        if (error) throw error;
      }

      // 3) Purge locale : la base et les caches ne doivent garder aucune trace.
      await database.write(async () => {
        await database.unsafeResetDatabase();
      });
      await AsyncStorage.clear();

      // 4) Déconnexion puis RÉINITIALISATION de la navigation : dismissAll
      //    vide la pile (sinon le bouton retour ramenait aux réglages, sur un
      //    compte qui n'existe plus), puis on ouvre la connexion.
      await supabase.auth.signOut();
      showToast(t("compte_supprimer_ok", langue), "success");
      router.dismissAll();
      router.replace("/(auth)/connexion");
    } catch {
      showToast(t("compte_supprimer_erreur", langue), "error");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <EnteteEcran titre={t("compte_titre", langue)} onRetour={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Carte style={{ marginBottom: 16 }}>
          <View style={styles.ligne}>
            <PuceIcone icone="mail" ton="bleu" taille={34} />
            <View style={{ flexShrink: 1 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{t("compte_email", langue)}</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 14, marginTop: 2 }}>{email || "—"}</Text>
            </View>
          </View>
        </Carte>

        {/* Zone dangereuse : visuellement distincte (bordure et fond rouges) pour
            qu'elle ne soit pas confondue avec un simple réglage. */}
        <Carte style={{ borderColor: colors.danger, backgroundColor: colors.dangerBg }}>
          <View style={styles.ligne}>
            <PuceIcone icone="alert-triangle" ton="rose" taille={34} />
            <Text style={{ color: colors.danger, fontSize: 15, fontWeight: "600", flexShrink: 1 }}>
              {t("compte_supprimer_titre", langue)}
            </Text>
          </View>

          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 12 }}>
            {t("compte_supprimer_avertissement", langue)}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
            {t("compte_supprimer_donnees", langue)}
          </Text>

          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 16, marginBottom: 6 }}>
            {t("compte_supprimer_saisie", langue)(motRequis)}
          </Text>
          {!enLigne && (
            <Text style={{ color: colors.danger, fontSize: 12, lineHeight: 17, marginTop: 12 }}>
              {t("compte_supprimer_hors_ligne", langue)}
            </Text>
          )}

          <TextInput
            value={motSaisi}
            onChangeText={setMotSaisi}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!enCours && enLigne}
            placeholder={motRequis}
            placeholderTextColor={colors.textMuted}
            style={[styles.saisie, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface, opacity: enLigne ? 1 : 0.5 }]}
          />

          <Pressable
            onPress={confirmer}
            disabled={!pret}
            style={[styles.boutonSupprimer, { backgroundColor: pret ? colors.danger : colors.border }]}
          >
            {enCours ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{t("compte_supprimer_encours", langue)}</Text>
              </View>
            ) : (
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{t("compte_supprimer_bouton", langue)}</Text>
            )}
          </Pressable>
        </Carte>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: "row", alignItems: "center", gap: 12 },
  saisie: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  boutonSupprimer: { marginTop: 16, paddingVertical: 13, borderRadius: 8, alignItems: "center" },
});
