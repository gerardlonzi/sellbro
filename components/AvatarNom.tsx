import { View, Text, StyleSheet } from "react-native";
import { ImageCachee } from "./ImageCachee";
import { useTheme } from "@/lib/theme/ThemeProvider";

// Avatar circulaire réutilisable : image si disponible, sinon initiales du
// nom (1re lettre des 2 premiers mots — « Bi man » → « BM »).
// Utilisé dans Stock, Clients, Ventes récentes et le panier de vente.
export function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return "?";
  return mots
    .slice(0, 2)
    .map((m) => m[0]!.toUpperCase())
    .join("");
}

export function AvatarNom({
  nom,
  imageUri,
  taille = 36,
}: {
  nom: string;
  imageUri?: string | null;
  taille?: number;
}) {
  const { colors } = useTheme();
  const style = { width: taille, height: taille, borderRadius: taille / 2 };

  if (imageUri) {
    // Fond coloré SOUS l'image : pendant le chargement (réseau lent), on
    // voit un cercle teinté au lieu d'un espace vide.
    return (
      <View style={[style, styles.conteneur, { backgroundColor: colors.accentBg, overflow: "hidden" }]}>
        <ImageCachee uri={imageUri} style={[style, styles.image]} />
      </View>
    );
  }

  return (
    <View style={[style, styles.conteneur, { backgroundColor: colors.accentBg }]}>
      <Text style={{ color: colors.accent, fontSize: taille * 0.34, fontWeight: "600" }}>
        {initiales(nom)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { alignItems: "center", justifyContent: "center" },
  image: { resizeMode: "cover" },
});
