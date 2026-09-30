import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";

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

export default function TabsLayout() {
  const { colors } = useTheme();
  const { langue } = useLangue();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarIcon: ({ focused, color, size }) => {
          const paire = ICONES[route.name];
          if (!paire) return null;
          return <Ionicons name={focused ? paire.actif : paire.inactif} size={size} color={color} />;
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
