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

export default function NouveauFournisseur() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [chargement, setChargement] = useState(false);

  async function sauvegarder() {
    if (!nom.trim()) {
      Alert.alert("", t("nouvelle_creance_erreur", langue));
      return;
    }
    setChargement(true);
    const userId = await obtenirUserId();
    if (!userId) return;
    await database.write(async () => {
      await database.get("fournisseurs").create((f: any) => {
        f.userId = userId;
        f.nom = nom.trim();
        f.telephone = telephone.trim() || null;
        f.totalAchats = 0;
        f.montantDu = 0;
        f.synchronise = false;
      });
    });

    setChargement(false);
    router.back();
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <EnteteEcran titre={t("fournisseurs_ajouter", langue)} onRetour={() => router.back()} />

      <Champ label={t("fournisseurs_nom", langue)} valeur={nom} onChange={setNom} colors={colors} />
      <Champ label={t("fournisseurs_telephone", langue)} valeur={telephone} onChange={setTelephone} colors={colors} />

      <Pressable onPress={sauvegarder} disabled={chargement} style={[styles.bouton, { backgroundColor: colors.accent, opacity: chargement ? 0.6 : 1 }]}>
        <Feather name="check" size={16} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{chargement ? "..." : t("nouvelle_creance_sauver", langue)}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Champ({ label, valeur, onChange, colors }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={valeur}
        onChangeText={onChange}
        style={{ borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 50 },
  bouton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 10, marginTop: 10 },
});