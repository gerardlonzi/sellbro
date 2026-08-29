import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";

const ICONES: Record<string, keyof typeof Feather.glyphMap> = {
  accueil: "home",
  stock: "package",
  clients: "users",
  ventes: "shopping-bag",
  dashboard: "bar-chart-2",
};

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarIcon: ({ color, size }) => <Feather name={ICONES[route.name]} size={size} color={color} />,
      })}
    >
      <Tabs.Screen name="accueil" options={{ title: "Accueil" }} />
      <Tabs.Screen name="stock" options={{ title: "Stock" }} />
      <Tabs.Screen name="clients" options={{ title: "Clients" }} />
      <Tabs.Screen name="ventes" options={{ title: "Ventes" }} />
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard" }} />
    </Tabs>
  );
}