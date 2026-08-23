import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Tes providers
import { ThemeProvider, useTheme } from "@/lib/theme/ThemeProvider";
import { CurrencyProvider } from "@/lib/currency/CurrencyProvider";
import { PaysProvider } from "@/lib/pays/PaysProvider";
import { CategoriesProvider } from "@/lib/categories/CategoriesProvider";
import { LangueProvider } from "@/lib/i18n";

// ---------------------------------------------------------
// IMPORTANT : empêcher le splash de disparaître
// automatiquement avant que l'application soit prête.
// ---------------------------------------------------------
SplashScreen.preventAutoHideAsync().catch(() => {
  // Le splash peut déjà être empêché de disparaître.
});

function AppContent() {
  const { colors } = useTheme();

  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // -------------------------------------------------
        // Mets ici les opérations nécessaires au démarrage
        // de ton application :
        //
        // - récupération des préférences
        // - initialisation de la DB
        // - vérification de connexion
        // - chargement de la langue
        // - etc.
        // -------------------------------------------------

        // Exemple :
        // await initialiserApplication();

      } catch (error) {
        console.error("Erreur initialisation application :", error);
      } finally {
        setAppReady(true);
      }
    }

    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (!appReady) {
      return;
    }

    try {
      await SplashScreen.hideAsync();
    } catch (error) {
      console.log("Erreur fermeture splash :", error);
    }
  }, [appReady]);

  // -------------------------------------------------------
  // Tant que l'application n'est pas prête, on ne rend pas
  // l'interface principale.
  // -------------------------------------------------------
  if (!appReady) {
    return (
      <View
        style={[
          styles.loadingContainer,
          {
            backgroundColor: colors.background,
          },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
        },
      ]}
      onLayout={onLayoutRootView}
    >
      <StatusBar style="auto" />

      <Stack
        screenOptions={{
          headerShown: false,

          // IMPORTANT :
          // empêche le fond blanc pendant les transitions.
          contentStyle: {
            backgroundColor: colors.background,
          },

          // Supprime/limite les effets de transition visibles
          animation: "fade",
        }}
      />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LangueProvider>
          <PaysProvider>
            <CategoriesProvider>
              <CurrencyProvider>
                <AppContent />
              </CurrencyProvider>
            </CategoriesProvider>
          </PaysProvider>
        </LangueProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  loadingContainer: {
    flex: 1,
  },
});