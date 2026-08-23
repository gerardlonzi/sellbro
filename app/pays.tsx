import { useState } from "react";
import { ScrollView, TextInput, Pressable, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { usePays } from "@/lib/pays/PaysProvider";
import { PAYS } from "@/lib/pays/pays";
import { EnteteEcran } from "@/components/UI";

export default function SelectionPays() {
  const { colors } = useTheme();
  const { pays, setPays } = usePays();
  const [recherche, setRecherche] = useState("");

  const paysFiltres = PAYS.filter(
    (p) =>
      p.nom.toLowerCase().includes(recherche.toLowerCase()) ||
      p.indicatif.includes(recherche)
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 14, paddingTop: 50 }}>
      <EnteteEcran titre="Pays" onRetour={() => router.back()} />
      <TextInput
        placeholder="Rechercher un pays ou un indicatif"
        placeholderTextColor={colors.textMuted}
        value={recherche}
        onChangeText={setRecherche}
        style={[styles.recherche, { borderColor: colors.border, color: colors.textPrimary }]}
      />
      {paysFiltres.map((p) => (
        <Pressable
          key={p.code}
          onPress={() => { setPays(p); router.back(); }}
          style={[styles.ligne, { borderColor: colors.border }]}
        >
          <Text style={{ fontSize: 13, color: colors.textPrimary }}>
            {p.drapeau}  {p.nom}  <Text style={{ color: colors.textMuted }}>{p.indicatif}</Text>
          </Text>
          {pays.code === p.code && <Feather name="check" size={16} color={colors.accent} />}
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  recherche: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, marginBottom: 14 },
  ligne: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 13, borderBottomWidth: 1 },
});