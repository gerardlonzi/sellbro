import { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { familleDepuisPoids } from "@/lib/theme/typography";

type NomIcone = keyof typeof Ionicons.glyphMap;

// Chaque onglet a sa paire : contour au repos, PLEINE quand il est actif.
// Feather n'a aucune variante pleine — d'où Ionicons, utilisé uniquement ici.
// Le reste de l'app continue d'utiliser Feather.
const ICONES: Record<string, { actif: NomIcone; inactif: NomIcone }> = {
  accueil: { actif: "home", inactif: "home-outline" },
  stock: { actif: "cube", inactif: "cube-outline" },
  ventes: { actif: "cart", inactif: "cart-outline" },
  plus: { actif: "grid", inactif: "grid-outline" },
  dashboard: { actif: "stats-chart", inactif: "stats-chart-outline" },
};

// Icône d'onglet animée : au passage en actif elle « saute » légèrement et
// une pastille translucide apparaît derrière elle.
function IconeOnglet({ nom, focused, couleur, fond }: { nom: NomIcone; focused: boolean; couleur: string; fond: string }) {
  const v = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: focused ? 1 : 0, useNativeDriver: true, speed: 18, bounciness: 14 }).start();
  }, [focused, v]);
  return (
    <View style={styles.zoneIcone}>
      <Animated.View
        style={[
          styles.pastille,
          { backgroundColor: fond, opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] },
        ]}
      />
      <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) }] }}>
        <Ionicons name={nom} size={22} color={couleur} />
      </Animated.View>
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const { langue } = useLangue();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        // Fondu entre onglets au lieu d'une coupure sèche.
        animation: "fade",
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: familleDepuisPoids(600), fontSize: 10.5, marginTop: -2 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth * 2,
          height: Platform.OS === "ios" ? 88 : 66,
          paddingTop: 6,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
          elevation: 14,
          shadowColor: colors.ombre,
          shadowOpacity: 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -4 },
        },
        tabBarIcon: ({ focused, color }) => {
          const paire = ICONES[route.name];
          if (!paire) return null;
          return <IconeOnglet nom={focused ? paire.actif : paire.inactif} focused={focused} couleur={color} fond={colors.accentBg} />;
        },
      })}
    >
      <Tabs.Screen name="accueil" options={{ title: t("onglet_accueil", langue) }} />
      <Tabs.Screen name="stock" options={{ title: t("onglet_stock", langue) }} />
      <Tabs.Screen name="ventes" options={{ title: t("onglet_ventes", langue) }} />
      {/* « Plus » remplace l'ancien onglet Clients, juste avant Dashboard. */}
      <Tabs.Screen name="plus" options={{ title: t("onglet_plus", langue) }} />
      <Tabs.Screen name="dashboard" options={{ title: t("onglet_dashboard", langue) }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  zoneIcone: { width: 48, height: 30, alignItems: "center", justifyContent: "center" },
  pastille: { position: "absolute", width: 46, height: 28, borderRadius: 14 },
});
