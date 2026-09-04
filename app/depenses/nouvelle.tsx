import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase/client";
import { database } from "@/lib/database";
import { EnteteEcran } from "@/components/UI";
import { obtenirUserId } from "@/lib/auth/userCache";

const CATEGORIES = ["loyer", "electricite", "transport", "salaire", "internet", "autre"];

export default function NouvelleDepense() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const [categorie, setCategorie] = useState("loyer");
  const [description, setDescription] = useState("");
  const [montant, setMontant] = useState("");
  const [chargement, setChargement] = useState(false);

  async function sauvegarder() {
    if (!montant) {
      Alert.alert("", t("nouvelle_creance_erreur", langue));
      return;
    }
    setChargement(true);
    const userId = await obtenirUserId();
    if (!userId) return;
    await database.write(async () => {
      await database.get("depenses").create((d: any) => {
        d.userId = userId;
        d.categorie = categorie;
        d.description = description.trim() || null;
        d.montant = Number(montant);
        d.synchronise = false;
      });
    });

    setChargement(false);
    router.back();
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <EnteteEcran titre={t("depenses_ajouter", langue)} onRetour={() => router.back()} />

      <Text style={styles.label}>{t("depenses_categorie", langue)}</Text>
      <View style={styles.ligneCategories}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCategorie(c)}
            style={[styles.puce, { borderColor: categorie === c ? colors.accent : colors.border, borderWidth: categorie === c ? 2 : 1 }]}
          >
            <Text style={{ color: categorie === c ? colors.accent : colors.textPrimary, fontSize: 12 }}>{t(`depense_cat_${c}` as any, langue)}</Text>
          </Pressable>
        ))}
      </View>

      <Champ label={t("depenses_montant", langue)} valeur={montant} onChange={setMontant} numerique colors={colors} />
      <Champ label={t("depenses_description", langue)} valeur={description} onChange={setDescription} colors={colors} />

      <Pressable onPress={sauvegarder} disabled={chargement} style={[styles.bouton, { backgroundColor: colors.accent, opacity: chargement ? 0.6 : 1 }]}>
        <Feather name="check" size={16} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{chargement ? "..." : t("nouvelle_creance_sauver", langue)}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Champ({ label, valeur, onChange, numerique, colors }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={valeur}
        onChangeText={onChange}
        keyboardType={numerique ? "numeric" : "default"}
        style={{ borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 50 },
  label: { fontSize: 12, marginBottom: 8, color: "#888" },
  ligneCategories: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  puce: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  bouton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 10, marginTop: 10 },
});