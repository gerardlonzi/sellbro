import { Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";

export function BoutonFlottant({ onPress, icone = "plus" }: { onPress: () => void; icone?: keyof typeof Feather.glyphMap }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.bouton, { backgroundColor: colors.accent }]}>
      <Feather name={icone} size={24} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bouton: {
    position: "absolute", bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28,
    alignItems: "center", justifyContent: "center", elevation: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
  },
});