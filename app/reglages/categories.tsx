import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCategories } from "@/lib/categories/CategoriesProvider";
import { EnteteEcran } from "@/components/UI";

export default function GestionCategories() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { categories, ajouterCategorie, supprimerCategorie } = useCategories();
  const [nouvelleCategorie, setNouvelleCategorie] = useState("");

  async function ajouter() {
    if (!nouvelleCategorie.trim()) return;
    await ajouterCategorie(nouvelleCategorie.trim());
    setNouvelleCategorie("");
  }

  function confirmerSuppression(nom: string) {
    Alert.alert(t("categories_supprimer_titre", langue), t("categories_supprimer_texte", langue)(nom), [
      { text: t("popup_non", langue), style: "cancel" },
      { text: t("categories_supprimer_confirmer", langue), style: "destructive", onPress: () => supprimerCategorie(nom) },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <EnteteEcran titre={t("categories_reglage_titre", langue)} onRetour={() => router.back()} />

      <View style={styles.ligneAjout}>
        <TextInput
          value={nouvelleCategorie}
          onChangeText={setNouvelleCategorie}
          placeholder={t("categories_ajouter_placeholder", langue)}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
        />
        <Pressable onPress={ajouter} style={[styles.boutonAjouter, { backgroundColor: colors.accent }]}>
          <Feather name="plus" size={18} color="#fff" />
        </Pressable>
      </View>

      <ScrollView>
        {categories.map((c) => (
          <View key={c} style={[styles.ligne, { borderBottomColor: colors.border }]}>
            <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{c}</Text>
            <Pressable onPress={() => confirmerSuppression(c)}>
              <Feather name="trash-2" size={16} color={colors.danger} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  ligneAjout: { flexDirection: "row", gap: 8, marginBottom: 16 },
  input: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  boutonAjouter: { width: 42, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  ligne: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1 },
});