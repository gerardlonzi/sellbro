import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { supabase } from "@/lib/supabase/client";
import { database } from "@/lib/database";
import { EnteteEcran } from "@/components/UI";

export default function NouvelAchat() {
  const { colors } = useTheme();
  const [fournisseur, setFournisseur] = useState("");
  const [description, setDescription] = useState("");
  const [montant, setMontant] = useState("");
  const [chargement, setChargement] = useState(false);

  async function sauvegarder() {
    if (!montant) {
      Alert.alert("", "Le montant est nécessaire.");
      return;
    }
    setChargement(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await database.write(async () => {
      await database.get("achats").create((a: any) => {
        a.userId = user.id;
        a.fournisseurNom = fournisseur.trim() || null;
        a.description = description.trim() || null;
        a.montant = Number(montant);
        a.source = "manuel";
        a.donneesSupplementairesJson = "{}";
        a.synchronise = false;
      });
    });

    setChargement(false);
    router.back();
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <EnteteEcran titre="Nouvel achat" onRetour={() => router.back()} />

      <Champ label="Fournisseur" valeur={fournisseur} onChange={setFournisseur} colors={colors} />
      <Champ label="Description" valeur={description} onChange={setDescription} colors={colors} />
      <Champ label="Montant" valeur={montant} onChange={setMontant} numerique colors={colors} />

      <Pressable onPress={sauvegarder} disabled={chargement} style={[styles.bouton, { backgroundColor: colors.accent, opacity: chargement ? 0.6 : 1 }]}>
        <Feather name="check" size={16} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{chargement ? "..." : "Enregistrer"}</Text>
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
  bouton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 10, marginTop: 10 },
});