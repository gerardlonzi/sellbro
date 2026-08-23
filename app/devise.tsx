import { useState } from "react";
import { ScrollView, TextInput, Pressable, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useCurrency, DEVISES } from "@/lib/currency/CurrencyProvider";
import { EnteteEcran } from "@/components/UI";

export default function SelectionDevise() {
  const { colors } = useTheme();
  const { devise, setDevise } = useCurrency();
  const [recherche, setRecherche] = useState("");

  const devisesFiltrees = DEVISES.filter(
    (d) =>
      d.nom.toLowerCase().includes(recherche.toLowerCase()) ||
      d.code.toLowerCase().includes(recherche.toLowerCase())
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 14, paddingTop: 50 }}
    >
      <EnteteEcran titre="Devise" onRetour={() => router.back()} />

      <TextInput
        placeholder="Rechercher une devise ou un pays"
        placeholderTextColor={colors.textMuted}
        value={recherche}
        onChangeText={setRecherche}
        style={[styles.recherche, { borderColor: colors.border, color: colors.textPrimary }]}
      />

      {devisesFiltrees.map((d) => (
        <Pressable
          key={d.code}
          onPress={() => { setDevise(d); router.back(); }}
          style={[styles.ligne, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{d.nom}</Text>
          {devise.code === d.code && <Feather name="check" size={16} color={colors.accent} />}
        </Pressable>
      ))}

      {devisesFiltrees.length === 0 && (
        <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 30 }}>
          Aucune devise trouvée
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  recherche: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, marginBottom: 14 },
  ligne: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 13, borderBottomWidth: 1 },
});