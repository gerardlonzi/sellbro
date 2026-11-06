import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { ThemeColors } from "@/lib/theme/colors";

// Tons disponibles, définis dans lib/theme/colors.ts (clair et sombre).
export type TonPuce = "violet" | "lilas" | "bleu" | "vert" | "ambre" | "rose";

// Trait + fond de chaque ton. Table explicite plutôt que clé construite : le
// compilateur vérifie ainsi que chaque ton existe bien dans les deux palettes
// (ThemeColors est dérivé de lightColors, donc darkColors doit suivre).
const TONS: Record<TonPuce, { trait: keyof ThemeColors; fond: keyof ThemeColors }> = {
  violet: { trait: "puceViolet", fond: "puceVioletBg" },
  lilas: { trait: "puceLilas", fond: "puceLilasBg" },
  bleu: { trait: "puceBleu", fond: "puceBleuBg" },
  vert: { trait: "puceVert", fond: "puceVertBg" },
  ambre: { trait: "puceAmbre", fond: "puceAmbreBg" },
  rose: { trait: "puceRose", fond: "puceRoseBg" },
};

// Icône posée sur une pastille colorée (carré arrondi). Remplace les icônes
// nues, qui se perdaient au milieu du texte.
export function PuceIcone({
  icone,
  ton = "violet",
  taille = 32,
  tailleIcone,
}: {
  icone: keyof typeof Feather.glyphMap;
  ton?: TonPuce;
  /** Côté du carré arrondi, en pixels. */
  taille?: number;
  /** Taille de l'icône. Par défaut ≈ 50 % de la pastille. */
  tailleIcone?: number;
}) {
  const { colors } = useTheme();
  const { trait, fond } = TONS[ton];

  return (
    <View
      style={[
        styles.puce,
        {
          width: taille,
          height: taille,
          // Proportionnel à la taille : la pastille garde la même silhouette
          // qu'elle soit posée dans une petite carte ou dans une ligne de liste.
          borderRadius: Math.round(taille * 0.32),
          backgroundColor: colors[fond],
        },
      ]}
    >
      <Feather name={icone} size={tailleIcone ?? Math.round(taille * 0.5)} color={colors[trait]} />
    </View>
  );
}

// Répartition déterministe des tons : une même icône garde toujours la même
// couleur d'un écran à l'autre. Sans ça, la même fonctionnalité changerait de
// couleur selon la page, ce qui donne une interface brouillonne.
const ORDRE_TONS: TonPuce[] = ["violet", "lilas", "bleu", "vert", "ambre", "rose"];

export function tonPourIcone(icone: string): TonPuce {
  let somme = 0;
  for (let i = 0; i < icone.length; i++) somme += icone.charCodeAt(i);
  return ORDRE_TONS[somme % ORDRE_TONS.length];
}

const styles = StyleSheet.create({
  puce: { alignItems: "center", justifyContent: "center" },
});
