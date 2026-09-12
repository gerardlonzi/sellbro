import { useEffect, useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useEssai } from "@/lib/trial/useEssai";

const CLE_BIENVENUE = "bienvenue_essai_vue";
const CLE_RAPPELS_VUS = "essai_rappels_vus";
const CLE_EXPIRATION_VUE = "essai_expiration_vue";

// Seuils de rappel (en jours restants), répartis sur la durée totale.
function seuilsRappels(dureeTotale: number): number[] {
  const nb = Math.min(3, Math.max(1, Math.round(dureeTotale / 3)));
  const seuils: number[] = [];
  for (let i = nb; i >= 1; i--) {
    seuils.push(Math.ceil((dureeTotale * i) / (nb + 1)));
  }
  return seuils;
}

type EtatPopup =
  | { type: "aucun" }
  | { type: "bienvenue" }
  | { type: "rappel"; jours: number }
  | { type: "expiration" };

// Pop-ups d'essai : bienvenue (une fois), rappels (répartis sur la durée),
// expiration. Non intrusifs : un seul pop-up par ouverture, jamais quotidien.
export function WelcomeTrial() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const essai = useEssai();
  const [popup, setPopup] = useState<EtatPopup>({ type: "aucun" });

  useEffect(() => {
    if (essai.estPremium) return;

    (async () => {
      const [bienvenue, rappelsVus, expirationVue] = await Promise.all([
        AsyncStorage.getItem(CLE_BIENVENUE),
        AsyncStorage.getItem(CLE_RAPPELS_VUS),
        AsyncStorage.getItem(CLE_EXPIRATION_VUE),
      ]);

      if (bienvenue !== "true") {
        setPopup({ type: "bienvenue" });
        return;
      }

      if (!essai.actif) {
        if (expirationVue !== "true") setPopup({ type: "expiration" });
        return;
      }

      // Rappels : on montre le prochain seuil atteint et non encore affiché.
      const vus: number[] = rappelsVus ? JSON.parse(rappelsVus) : [];
      const prochain = seuilsRappels(essai.dureeTotale).find(
        (seuil) => essai.joursRestants <= seuil && !vus.includes(seuil)
      );
      if (prochain != null) setPopup({ type: "rappel", jours: essai.joursRestants });
    })();
  }, [essai.estPremium, essai.actif, essai.joursRestants, essai.dureeTotale]);

  async function fermer() {
    if (popup.type === "bienvenue") await AsyncStorage.setItem(CLE_BIENVENUE, "true");
    if (popup.type === "expiration") await AsyncStorage.setItem(CLE_EXPIRATION_VUE, "true");
    if (popup.type === "rappel") {
      // Marque le seuil correspondant comme déjà affiché.
      const vus: number[] = JSON.parse((await AsyncStorage.getItem(CLE_RAPPELS_VUS)) ?? "[]");
      const seuil = seuilsRappels(essai.dureeTotale).find((s) => essai.joursRestants <= s && !vus.includes(s));
      if (seuil != null) {
        vus.push(seuil);
        await AsyncStorage.setItem(CLE_RAPPELS_VUS, JSON.stringify(vus));
      }
    }
    setPopup({ type: "aucun" });
  }

  function allerPro() {
    fermer();
    router.push("/premium");
  }

  if (popup.type === "aucun") return null;

  const estBienvenue = popup.type === "bienvenue";
  const estExpiration = popup.type === "expiration";

  const titre = estBienvenue
    ? t("bienvenue_essai_titre", langue)
    : estExpiration
    ? t("essai_termine_titre", langue)
    : t("bienvenue_essai_titre", langue);

  const corps = estBienvenue
    ? t("bienvenue_essai_ligne1", langue)(essai.dureeTotale)
    : estExpiration
    ? t("essai_termine_texte", langue)
    : t("rappel_essai_ligne1", langue)(popup.jours);

  const sousCorps = estBienvenue ? t("bienvenue_essai_ligne2", langue)(essai.prix) : estExpiration ? "" : t("rappel_essai_ligne2", langue);

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.fond}>
        <View style={[styles.carte, { backgroundColor: colors.surface }]}>
          <View style={[styles.icone, { backgroundColor: estExpiration ? colors.dangerBg : colors.proBg }]}>
            <Feather name={estExpiration ? "alert-circle" : "gift"} size={24} color={estExpiration ? colors.danger : colors.pro} />
          </View>
          <Text style={[styles.titre, { color: colors.textPrimary }]}>{titre}</Text>
          <Text style={[styles.texte, { color: colors.textSecondary }]}>{corps}</Text>
          {sousCorps ? <Text style={[styles.texte, { color: colors.textSecondary, marginTop: 6 }]}>{sousCorps}</Text> : null}

          <View style={styles.ligneBoutons}>
            <Pressable onPress={fermer} style={[styles.boutonSecondaire, { borderColor: colors.border }]}>
              <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "500" }}>
                {estExpiration ? "OK" : estBienvenue ? t("bienvenue_essai_ok", langue) : t("rappel_essai_plus_tard", langue)}
              </Text>
            </Pressable>
            <Pressable onPress={allerPro} style={[styles.boutonPro, { backgroundColor: colors.proFill }]}>
              <Text style={{ color: colors.onPro, fontSize: 14, fontWeight: "600" }}>
                {estExpiration ? t("essai_termine_pro", langue) : t("bienvenue_essai_pro", langue)}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  carte: { width: "100%", maxWidth: 340, borderRadius: 16, padding: 24, alignItems: "center" },
  icone: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  titre: { fontSize: 17, fontWeight: "600", marginBottom: 10, textAlign: "center" },
  texte: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  ligneBoutons: { flexDirection: "row", gap: 10, marginTop: 20, alignSelf: "stretch" },
  boutonSecondaire: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: "center", borderWidth: 1 },
  boutonPro: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: "center" },
});