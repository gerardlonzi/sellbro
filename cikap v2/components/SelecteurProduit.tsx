import { useMemo, useState } from "react";
import { Animated, FlatList, Modal, Pressable, StyleSheet, View, KeyboardAvoidingView, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Text, TextInput } from "@/components/Texte";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { normaliserLibelle } from "@/lib/scanner/normalisation";
import { ProduitCandidat } from "@/lib/scanner/matching";
import { PressableAnime } from "@/components/anim";

// Feuille de choix d'un produit du catalogue, avec : suggestions du matching
// (les plus proches du libellé lu), recherche libre, création explicite d'un
// nouveau produit et option « sans produit du catalogue ».
export function SelecteurProduit({
  visible,
  libelleLu,
  catalogue,
  suggestions,
  produitActuel,
  onFermer,
  onChoisir,
  onCreer,
}: {
  visible: boolean;
  libelleLu: string;
  catalogue: ProduitCandidat[];
  suggestions: { productId: string; nom: string; score: number }[];
  produitActuel: string | null;
  onFermer: () => void;
  onChoisir: (produitId: string | null) => void;
  onCreer: (nom: string) => void;
}) {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const [recherche, setRecherche] = useState("");

  const filtres = useMemo(() => {
    const q = normaliserLibelle(recherche);
    const liste = q ? catalogue.filter((p) => normaliserLibelle(p.nom).includes(q)) : catalogue;
    return liste.slice(0, 80);
  }, [recherche, catalogue]);

  const idsSuggeres = new Set(suggestions.map((s) => s.productId));
  const nomCreation = (recherche.trim() || libelleLu).trim();

  function ligne(id: string, nom: string, prix?: number, score?: number) {
    const actif = produitActuel === id;
    return (
      <PressableAnime
        key={id}
        onPress={() => {
          setRecherche("");
          onChoisir(id);
        }}
        echelle={0.98}
        style={[styles.ligne, { backgroundColor: actif ? colors.accentBg : colors.surface, borderColor: actif ? colors.accent : colors.border }]}
      >
        <View style={[styles.avatar, { backgroundColor: colors.accentBg }]}>
          <Feather name="package" size={16} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "600" }}>{nom}</Text>
          {score != null && <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}>{Math.round(score * 100)} %</Text>}
        </View>
        {actif && <Feather name="check-circle" size={18} color={colors.accent} />}
      </PressableAnime>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onFermer} statusBarTranslucent>
      <View style={[styles.fond, { backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onFermer} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
          <View style={[styles.feuille, { backgroundColor: colors.background }]}>
            <View style={[styles.poignee, { backgroundColor: colors.border }]} />
            <View style={styles.entete}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "800" }}>{t("val_picker_titre", langue)}</Text>
                <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  {t("val_lu", langue)} : « {libelleLu} »
                </Text>
              </View>
              <Pressable onPress={onFermer} hitSlop={10}>
                <Feather name="x" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={[styles.recherche, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Feather name="search" size={16} color={colors.textMuted} />
              <TextInput
                value={recherche}
                onChangeText={setRecherche}
                placeholder={t("val_picker_recherche", langue)}
                placeholderTextColor={colors.textMuted}
                style={{ flex: 1, color: colors.textPrimary, fontSize: 14, paddingVertical: 11 }}
              />
            </View>

            <FlatList
              data={filtres}
              keyExtractor={(p) => p.id}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 360 }}
              contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
              ListHeaderComponent={
                !recherche && suggestions.length > 0 ? (
                  <View style={{ gap: 8, marginBottom: 6 }}>
                    <Text style={[styles.section, { color: colors.textMuted }]}>{t("val_picker_suggestions", langue)}</Text>
                    {suggestions.map((s) => ligne(s.productId, s.nom, undefined, s.score))}
                    <Text style={[styles.section, { color: colors.textMuted, marginTop: 6 }]}>{t("val_picker_catalogue", langue)}</Text>
                  </View>
                ) : null
              }
              renderItem={({ item }) => (!recherche && idsSuggeres.has(item.id) ? null : ligne(item.id, item.nom, item.prixVente))}
              ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: "center", paddingVertical: 18 }}>{t("val_picker_aucun", langue)}</Text>}
            />

            <View style={{ gap: 8, marginTop: 6 }}>
              {nomCreation.length > 0 && (
                <PressableAnime onPress={() => onCreer(nomCreation)} style={[styles.action, { borderColor: colors.accent, backgroundColor: colors.accentBg }]}>
                  <Feather name="plus-circle" size={17} color={colors.accent} />
                  <Text numberOfLines={1} style={{ color: colors.accent, fontSize: 14, fontWeight: "700", flex: 1 }}>
                    {t("val_picker_creer", langue)} : « {nomCreation} »
                  </Text>
                </PressableAnime>
              )}
              <Pressable onPress={() => onChoisir(null)} style={styles.lienSans}>
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>{t("val_picker_sans", langue)}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, justifyContent: "flex-end" },
  feuille: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18, paddingBottom: 28 },
  poignee: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  entete: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  recherche: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, marginBottom: 12 },
  section: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  ligne: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 10 },
  avatar: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  action: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, padding: 13 },
  lienSans: { alignItems: "center", paddingVertical: 10 },
});
