import { useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { IconeIA } from "@/components/IconeIA";
import { Text } from "@/components/Texte";
import { PressableAnime } from "@/components/anim";

export type ActionFlottante = {
  icone: keyof typeof Feather.glyphMap;
  libelle: string;
  onPress: () => void;
  // Fonction réservée (IA) : petit cadenas quand le compte n'y a pas accès.
  verrouille?: boolean;
  ia?: "scan" | "vocal";
};

// Bouton flottant. Sans `actions` : simple bouton « + ». Avec `actions` :
// « speed dial » — le + pivote en × et les actions se déploient au-dessus,
// sur un voile qui assombrit l'écran.
export function BoutonFlottant({
  onPress,
  icone = "plus",
  actions,
}: {
  onPress?: () => void;
  icone?: keyof typeof Feather.glyphMap;
  actions?: ActionFlottante[];
}) {
  const { colors } = useTheme();
  const [ouvert, setOuvert] = useState(false);
  const progression = useRef(new Animated.Value(0)).current;

  function basculer(valeur: boolean) {
    setOuvert(valeur);
    Animated.timing(progression, {
      toValue: valeur ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  const aDesActions = !!actions?.length;

  return (
    <>
      {aDesActions && ouvert && (
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: progression, zIndex: 40 }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => basculer(false)} />
        </Animated.View>
      )}

      {aDesActions &&
        actions!.map((action, i) => {
          const decalage = (actions!.length - i) * 62;
          return (
            <Animated.View
              key={action.libelle}
              pointerEvents={ouvert ? "auto" : "none"}
              style={[
                styles.ligneAction,
                {
                  opacity: progression,
                  transform: [
                    { translateY: progression.interpolate({ inputRange: [0, 1], outputRange: [20, -decalage] }) },
                    { scale: progression.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
                  ],
                },
              ]}
            >
              <View style={[styles.etiquette, { backgroundColor: colors.surface }]}>
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600" }}>{action.libelle}</Text>
              </View>
              <PressableAnime
                onPress={() => {
                  basculer(false);
                  action.onPress();
                }}
                style={[styles.miniBouton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                {action.ia ? <IconeIA type={action.ia} taille={19} couleur={colors.accent} /> : <Feather name={action.icone} size={19} color={colors.accent} />}
                {action.verrouille && (
                  <View style={[styles.cadenas, { backgroundColor: colors.proFill }]}>
                    <Feather name="lock" size={8} color="#fff" />
                  </View>
                )}
              </PressableAnime>
            </Animated.View>
          );
        })}

      <PressableAnime
        onPress={() => (aDesActions ? basculer(!ouvert) : onPress?.())}
        style={styles.bouton}
        echelle={0.92}
      >
        <LinearGradient colors={[colors.accentClair, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.degrade}>
          <Animated.View
            style={{ transform: [{ rotate: progression.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "135deg"] }) }] }}
          >
            <Feather name={icone} size={26} color="#fff" />
          </Animated.View>
        </LinearGradient>
      </PressableAnime>
    </>
  );
}

const styles = StyleSheet.create({
  bouton: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    zIndex: 60,
  },
  degrade: {
    flex: 1,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#14917A",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  ligneAction: { position: "absolute", bottom: 29, right: 24, zIndex: 55, flexDirection: "row", alignItems: "center", gap: 12 },
  etiquette: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  miniBouton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  cadenas: { position: "absolute", top: -2, right: -2, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});
