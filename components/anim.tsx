import { ReactNode, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  GestureResponderEvent,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";

// Briques d'animation de l'app. Tout passe par le driver NATIF (opacité /
// transformations) : aucune animation ne tourne sur le thread JS, donc elles
// restent fluides même pendant les requêtes base de données.

// Apparition douce : fondu + glissement vers le haut. `delai` permet
// d'enchaîner les blocs d'un écran (effet « cascade »).
export function Apparition({
  children,
  delai = 0,
  duree = 460,
  depuis = 16,
  style,
}: {
  children: ReactNode;
  delai?: number;
  duree?: number;
  depuis?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progression = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progression, {
      toValue: 1,
      duration: duree,
      delay: delai,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progression, delai, duree]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progression,
          transform: [{ translateY: progression.interpolate({ inputRange: [0, 1], outputRange: [depuis, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// Clés de style qui concernent la PLACE du bouton dans son parent (elles
// restent sur l'enveloppe animée) ; le reste (fond, bordure, alignement
// interne…) s'applique au Pressable qui contient le contenu.
const CLES_PLACE = new Set([
  "flex", "flexGrow", "flexShrink", "flexBasis", "alignSelf", "width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight",
  "margin", "marginTop", "marginBottom", "marginLeft", "marginRight", "marginHorizontal", "marginVertical",
  "position", "top", "bottom", "left", "right", "zIndex",
]);

// Pressable avec retour tactile : léger rétrécissement à l'appui, rebond au
// relâchement. À utiliser pour tout élément cliquable important.
export function PressableAnime({
  children,
  style,
  onPressIn,
  onPressOut,
  echelle = 0.96,
  ...props
}: PressableProps & { style?: StyleProp<ViewStyle>; echelle?: number; children?: ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  function vers(valeur: number) {
    Animated.spring(scale, { toValue: valeur, useNativeDriver: true, speed: 40, bounciness: valeur === 1 ? 10 : 0 }).start();
  }
  const plat = (StyleSheet.flatten(style) ?? {}) as Record<string, any>;
  const place: Record<string, any> = {};
  const visuel: Record<string, any> = {};
  for (const k of Object.keys(plat)) (CLES_PLACE.has(k) ? place : visuel)[k] = plat[k];
  // Dimensions / flex fixées sur l'enveloppe : le Pressable la remplit.
  const remplit = "flex" in place || "flexGrow" in place || "height" in place || "width" in place;
  return (
    <Animated.View style={[place, { transform: [{ scale }] }]}>
      <Pressable
        {...props}
        style={[visuel, remplit && { flex: 1 }]}
        onPressIn={(e: GestureResponderEvent) => {
          vers(echelle);
          onPressIn?.(e);
        }}
        onPressOut={(e: GestureResponderEvent) => {
          vers(1);
          onPressOut?.(e);
        }}
      >
        {children as ReactNode}
      </Pressable>
    </Animated.View>
  );
}

// Boucle de « respiration » (halo, pulsation d'un micro, étincelle…).
export function usePulsation(actif = true, duree = 1400, min = 0, max = 1) {
  const valeur = useRef(new Animated.Value(min)).current;
  useEffect(() => {
    if (!actif) {
      valeur.setValue(min);
      return;
    }
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.timing(valeur, { toValue: max, duration: duree, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(valeur, { toValue: min, duration: duree, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    boucle.start();
    return () => boucle.stop();
  }, [actif, duree, min, max, valeur]);
  return valeur;
}

// Reflet qui traverse un bouton (appel à l'action « premium »).
export function useBalayage(duree = 2200, pause = 1400) {
  const valeur = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.timing(valeur, { toValue: 1, duration: duree, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(pause),
        Animated.timing(valeur, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    boucle.start();
    return () => boucle.stop();
  }, [valeur, duree, pause]);
  return valeur;
}
