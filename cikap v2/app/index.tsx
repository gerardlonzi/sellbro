import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { CLE_EMAIL_EN_ATTENTE } from "@/lib/auth/emailVerification";

export default function Index() {
  const { colors } = useTheme();
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // 1. Une vérification d'email est en attente ? On y redirige de force,
      //    même si l'onboarding semblait terminé, tant que le code n'est pas
      //    saisi et l'email vérifié.
      const emailEnAttente = await AsyncStorage.getItem(CLE_EMAIL_EN_ATTENTE);
      if (emailEnAttente) {
        setDestination(`/(auth)/verification-otp?email=${encodeURIComponent(emailEnAttente)}`);
        return;
      }

      // 2. Sinon, on reprend le parcours normal.
      const termine = await AsyncStorage.getItem("onboarding_termine");
      setDestination(termine === "true" ? "/(tabs)/accueil" : "/onboarding/demarrage");
    })();
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