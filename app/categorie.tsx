import { useState } from "react";
import { ScrollView, TextInput, Pressable, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCategories } from "@/lib/categories/CategoriesProvider";
import { EnteteEcran } from "@/components/UI";
import { envoyerSelectionCategorie } from "@/lib/categories/relaisSelection";

export default function SelectionCategorie() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { categories, ajouterCategorie } = useCategories();
  const [recherche, setRecherche] = useState("");

  const filtrees = categories.filter((c) => c.toLowerCase().includes(recherche.toLowerCase()));
  const peutCreer = recherche.trim().length > 0 && !categories.some((c) => c.toLowerCase() === recherche.trim().toLowerCase());

  function choisir(nom: string) {
    envoyerSelectionCategorie(nom);
    router.back();
  }

async function creerEtChoisir() {
  await ajouterCategorie(recherche.trim());
  choisir(recherche.trim());
}

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 14, paddingTop: 50 }}>
      <EnteteEcran titre={t("categorie_titre", langue)} onRetour={() => router.back()} />
      <TextInput
        placeholder={t("categorie_recherche", langue)}
        placeholderTextColor={colors.textMuted}
        value={recherche}
        onChangeText={setRecherche}
        style={[styles.recherche, { borderColor: colors.border, color: colors.textPrimary }]}
      />

      {peutCreer && (
        <Pressable onPress={creerEtChoisir} style={[styles.ligneCreation, { borderColor: colors.accent }]}>
          <Feather name="plus" size={16} color={colors.accent} />
          <Text style={{ color: colors.accent, fontSize: 13 }}>
            {t("categorie_creer", langue)} "{recherche.trim()}"
          </Text>
        </Pressable>
      )}

      {filtrees.map((c) => (
        <Pressable key={c} onPress={() => choisir(c)} style={[styles.ligne, { borderColor: colors.border }]}>
          <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{c}</Text>
          <Feather name="chevron-right" size={15} color={colors.textMuted} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  recherche: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, marginBottom: 12 },
  ligneCreation: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 10 },
  ligne: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 13, borderBottomWidth: 1 },
});