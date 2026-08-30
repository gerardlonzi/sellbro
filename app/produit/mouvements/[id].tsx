import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { historiqueMouvements } from "@/lib/stock/mouvements";
import { EnteteEcran } from "@/components/UI";

const ICONES: Record<string, keyof typeof Feather.glyphMap> = {
  achat: "arrow-down-circle",
  vente: "arrow-up-circle",
  retour: "corner-up-left",
  casse: "alert-triangle",
  ajustement: "sliders",
  peremption: "clock",
};

export default function MouvementsProduit() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [mouvements, setMouvements] = useState<any[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    historiqueMouvements(id).then((data) => {
      setMouvements(data);
      setChargement(false);
    });
  }, [id]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <EnteteEcran titre="Mouvements de stock" onRetour={() => router.back()} />

      {chargement ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : mouvements.length === 0 ? (
        <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center", marginTop: 40 }}>
          Aucun mouvement enregistré pour ce produit
        </Text>
      ) : (
        <ScrollView>
          {mouvements.map((m) => (
            <View key={m.id} style={[styles.ligne, { borderBottomColor: colors.border }]}>
              <Feather name={ICONES[m.type] ?? "circle"} size={16} color={m.quantite >= 0 ? colors.success : colors.danger} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{m.raison ?? m.type}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>{m.creeLe.toLocaleDateString()} — {m.stockAvant} → {m.stockApres}</Text>
              </View>
              <Text style={{ color: m.quantite >= 0 ? colors.success : colors.danger, fontSize: 13, fontWeight: "500" }}>
                {m.quantite >= 0 ? "+" : ""}{m.quantite}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
});