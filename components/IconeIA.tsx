import { StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Text } from "@/components/Texte";

// Icône d'outil IA : le pictogramme (caméra / micro) + une pastille « IA »
// à étincelle, pour qu'on voie tout de suite que c'est une fonction intelligente.
export function IconeIA({ type, taille = 22, couleur = "#fff" }: { type: "scan" | "vocal"; taille?: number; couleur?: string }) {
  const badge = Math.max(13, Math.round(taille * 0.62));
  return (
    <View style={{ width: taille + 6, height: taille + 6, alignItems: "center", justifyContent: "center" }}>
      <Feather name={type === "scan" ? "camera" : "mic"} size={taille} color={couleur} />
      <View style={[styles.badge, { height: badge, minWidth: badge + 4, borderRadius: badge / 2 }]}>
        <Text style={{ color: "#2A1D00", fontSize: Math.max(7, badge * 0.55), fontWeight: "900", letterSpacing: 0.2 }}>IA</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { position: "absolute", top: -4, right: -7, backgroundColor: "#FFD166", alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
});
