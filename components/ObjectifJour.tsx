import { useEffect, useState } from "react";
import { View, Text, Pressable, Modal, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { PuceIcone } from "@/components/PuceIcone";
import { obtenirUserId } from "@/lib/auth/userCache";

const CLE_PREFIXE = "objectif_journalier_";

// Objectif de chiffre d'affaires du jour, propre à chaque compte : la clé de
// stockage porte l'id de l'utilisateur pour qu'un objectif ne fuite pas d'un
// compte à l'autre sur un appareil partagé.
async function cleObjectif(): Promise<string> {
  const userId = await obtenirUserId();
  return `${CLE_PREFIXE}${userId ?? "anonyme"}`;
}

// Barre de progression de l'objectif du jour sur l'accueil. Un appui ouvre la
// saisie de l'objectif ; l'objectif est mémorisé par compte.
export function ObjectifJour({ ca }: { ca: number }) {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { formater, formaterCompact } = useCurrency();
  const [objectif, setObjectif] = useState<number | null>(null);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [saisie, setSaisie] = useState("");

  useEffect(() => {
    (async () => {
      const brut = await AsyncStorage.getItem(await cleObjectif());
      const valeur = brut ? parseInt(brut, 10) : NaN;
      if (Number.isFinite(valeur) && valeur > 0) setObjectif(valeur);
    })();
  }, []);

  async function enregistrer() {
    const valeur = parseInt(saisie.replace(/\s/g, ""), 10);
    if (!Number.isFinite(valeur) || valeur <= 0) {
      setModalOuvert(false);
      return;
    }
    setObjectif(valeur);
    await AsyncStorage.setItem(await cleObjectif(), String(valeur)).catch(() => {});
    setModalOuvert(false);
  }

  // Sans objectif défini : une carte d'invitation discrète, pas un bloc vide.
  if (objectif == null) {
    return (
      <Pressable
        onPress={() => { setSaisie(""); setModalOuvert(true); }}
        style={[styles.carte, styles.carteInvitation, { borderColor: colors.borderPro }]}
      >
        <PuceIcone icone="target" ton="lilas" taille={32} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600" }}>{t("objectif_titre", langue)}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 5 }}>{t("objectif_definir", langue)}</Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
        {modal()}
      </Pressable>
    );
  }

  const progression = Math.min(1, ca / objectif);
  const atteint = ca >= objectif;

  return (
    <Pressable
      onPress={() => { setSaisie(String(objectif)); setModalOuvert(true); }}
      style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.ligneHaut}>
        <PuceIcone icone="target" ton={atteint ? "vert" : "lilas"} taille={32} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "500" }}>{t("objectif_titre", langue)}</Text>
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "700", marginTop: 2 }}>
            {formaterCompact(ca)} <Text style={{ color: colors.textMuted, fontWeight: "400", fontSize: 12 }}>/ {formater(objectif)}</Text>
          </Text>
        </View>
        {atteint && <Feather name="check-circle" size={18} color={colors.success} />}
      </View>
      <View style={[styles.piste, { backgroundColor: colors.border }]}>
        <View style={[styles.remplissage, { width: `${Math.round(progression * 100)}%`, backgroundColor: atteint ? colors.success : colors.puceLilas }]} />
      </View>
      {modal()}
    </Pressable>
  );

  function modal() {
    return (
      <Modal visible={modalOuvert} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <Pressable style={styles.fondModal} onPress={() => setModalOuvert(false)}>
            <Pressable style={[styles.carteModal, { backgroundColor: colors.surface }]} onPress={() => {}}>
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "600" }}>{t("objectif_titre", langue)}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4, textAlign: "center" }}>{t("objectif_modal_texte", langue)}</Text>
              <TextInput
                value={saisie}
                onChangeText={setSaisie}
                keyboardType="numeric"
                autoFocus
                placeholder={t("objectif_placeholder", langue)}
                placeholderTextColor={colors.textMuted}
                style={[styles.saisie, { borderColor: colors.border, color: colors.textPrimary }]}
              />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16, alignSelf: "stretch" }}>
                <Pressable onPress={() => setModalOuvert(false)} style={[styles.bouton, { borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "500" }}>{t("popup_annuler", langue)}</Text>
                </Pressable>
                <Pressable onPress={enregistrer} style={[styles.bouton, { backgroundColor: colors.accent }]}>
                  <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{t("popup_ok", langue)}</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    );
  }
}

const styles = StyleSheet.create({
  carte: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 10 },
  carteInvitation: { flexDirection: "row", alignItems: "center", borderStyle: "dashed" },
  ligneHaut: { flexDirection: "row", alignItems: "center" },
  piste: { height: 6, borderRadius: 3, marginTop: 12, overflow: "hidden" },
  remplissage: { height: 6, borderRadius: 3 },
  fondModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  carteModal: { width: "100%", maxWidth: 340, borderRadius: 16, padding: 24, alignItems: "center" },
  saisie: { alignSelf: "stretch", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, marginTop: 16 },
  bouton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: "center" },
});
