import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "@/components/Texte";

// Écran d'ouverture animé : prend le relais du splash natif (même logo, même
// position) puis s'anime — le logo respire, un halo s'élargit, le nom de la
// marque apparaît — et se dissout pour révéler l'app. Dure ~1,6 s.
export function SplashAnime({ onTermine }: { onTermine: () => void }) {
  const logo = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const texte = useRef(new Animated.Value(0)).current;
  const sortie = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logo, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 12 }),
        Animated.timing(halo, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(texte, { toValue: 1, duration: 600, delay: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.delay(350),
      Animated.timing(sortie, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => onTermine());
  }, [logo, halo, texte, sortie, onTermine]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: sortie, zIndex: 999 }]} pointerEvents="auto">
      <LinearGradient colors={["#0B3D33", "#0E5A4A", "#14917A"]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.centre}>
        <Animated.View
          style={[
            styles.halo,
            {
              opacity: halo.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.35, 0] }),
              transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.4] }) }],
            },
          ]}
        />
        <Animated.View
          style={{
            opacity: logo,
            transform: [
              { scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
              { rotate: logo.interpolate({ inputRange: [0, 1], outputRange: ["-8deg", "0deg"] }) },
            ],
          }}
        >
          <View style={styles.tuile}>
            <Image source={require("@/assets/logo-mark.png")} style={styles.logo} resizeMode="contain" />
          </View>
        </Animated.View>
        <Animated.View
          style={{
            opacity: texte,
            transform: [{ translateY: texte.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
            alignItems: "center",
            marginTop: 22,
          }}
        >
          <Text style={styles.nom}>Cikap</Text>
          <Text style={styles.slogan}>Ton commerce, sous contrôle</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "#7FE5CD" },
  tuile: {
    width: 108,
    height: 108,
    borderRadius: 30,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  logo: { width: 66, height: 59 },
  nom: { color: "#fff", fontSize: 34, fontWeight: "800", letterSpacing: -0.8 },
  slogan: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "500", marginTop: 4, letterSpacing: 0.3 },
});
