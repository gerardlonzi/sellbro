import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/lib/theme/ThemeProvider";

export default function Index() {
  const { colors } = useTheme();
  const [destination, setDestination] = useState<string | null>(null);
  
  useEffect(() => {
    AsyncStorage.getItem("onboarding_termine").then((termine) => {
      setDestination(termine === "true" ? "/(tabs)/accueil" : "/onboarding/demarrage");
    });
  }, []);

  if (!destination) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  // Redirect s'intègre dans le rendu React normal, contrairement à
  // router.replace() qui force une navigation impérative — c'est ça qui
  // évite l'erreur "before mounting the Root Layout component".
  return <Redirect href={destination as any} />;
}