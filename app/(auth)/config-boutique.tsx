import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase/client";
import { useTheme } from "@/lib/theme/ThemeProvider";

// Cet écran ne bloque jamais l'utilisateur : "Passer" mène directement
// à l'accueil, et le nom de boutique peut être renseigné plus tard
// dans Réglages.
export default function ConfigBoutique() {
  const { colors } = useTheme();
  const [nomBoutique, setNomBoutique] = useState("");

  async function continuer(sauverNom: boolean) {
    if (sauverNom && nomBoutique.trim().length > 0) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({ nom_boutique: nomBoutique }).eq("id", user.id);
      }
    }
    router.replace("/(tabs)/accueil");
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.entete}>
        <Text style={[styles.titre, { color: colors.textPrimary }]}>Configure ta boutique</Text>
        <Pressable onPress={() => continuer(false)}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Passer</Text>
        </Pressable>
      </View>
      <Text style={[styles.sousTitre, { color: colors.textMuted }]}>
        Facultatif — tu peux le faire plus tard dans Réglages
      </Text>

      <Text style={[styles.label, { color: colors.textSecondary }]}>Nom de la boutique</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
        placeholder="Ex: Boutique Awa"
        placeholderTextColor={colors.textMuted}
        value={nomBoutique}
        onChangeText={setNomBoutique}
      />

      <Pressable
        style={[styles.bouton, { backgroundColor: colors.accent }]}
        onPress={() => continuer(true)}
      >
        <Text style={styles.boutonTexte}>Continuer</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60 },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  titre: { fontSize: 17, fontWeight: "500" },
  sousTitre: { fontSize: 12, marginBottom: 24 },
  label: { fontSize: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 24 },
  bouton: { paddingVertical: 14, borderRadius: 8, alignItems: "center" },
  boutonTexte: { color: "#fff", fontSize: 15, fontWeight: "500" },
});
