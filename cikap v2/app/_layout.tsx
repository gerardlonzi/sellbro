import React, { useEffect, useState } from "react";
import { View, StyleSheet, InteractionManager } from "react-native";
import { Stack, router } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { POLICES_A_CHARGER } from "@/lib/theme/typography";
import { SplashAnime } from "@/components/SplashAnime";

// Tes providers
import { ThemeProvider, useTheme } from "@/lib/theme/ThemeProvider";
import { ToastProvider } from "@/lib/toast/ToastProvider";
import { CurrencyProvider } from "@/lib/currency/CurrencyProvider";
import { PaysProvider } from "@/lib/pays/PaysProvider";
import { CategoriesProvider } from "@/lib/categories/CategoriesProvider";
import { LangueProvider } from "@/lib/i18n";
import { useSynchronisation } from "@/lib/sync/useSynchronisation";
import { verifierAlertesEtNotifier } from "@/lib/notifications/notifications";
import { enregistrerTokenPush } from "@/lib/notifications/push";
import { PaywallPopup } from "@/components/PaywallPopup";
import { SyncBanner } from "@/components/SyncBanner";
import { supabase } from "@/lib/supabase/client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { synchroniserTout } from "@/lib/database/sync";
import { rafraichirPlan, reinitialiserPlan } from "@/lib/plan/planStore";
import { effacerCacheEssai } from "@/lib/trial/deviceTrial";

// ---------------------------------------------------------
// IMPORTANT : empêcher le splash de disparaître
// automatiquement avant que l'application soit prête.
// ---------------------------------------------------------
SplashScreen.preventAutoHideAsync().catch(() => {
  // Le splash peut déjà être empêché de disparaître.
});

function AppContent() {
  const { colors } = useTheme();

  // Synchronise local <-> Supabase au démarrage et à chaque retour de connexion.
  useSynchronisation();

  // Synchronise automatiquement dès qu'un utilisateur se connecte (login sur
  // un nouvel appareil) — évite de devoir forcer la fermeture/réouverture.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((evenement, session) => {
      // ⚠️ Ne JAMAIS attendre un appel Supabase directement dans ce callback :
      // supabase-js le exécute sous le verrou d'authentification, et un
      // getUser()/requête à l'intérieur reste bloqué (timeout) — c'était la
      // cause de « pas de synchro après connexion » et du plan Pro perdu.
      // On diffère donc le travail d'un tour de boucle, avec l'id de session.
      if (session?.user && (evenement === "SIGNED_IN" || evenement === "INITIAL_SESSION")) {
        const userId = session.user.id;
        setTimeout(async () => {
          // 1) Le plan d'abord (il décide si le PUSH est autorisé), 2) la synchro.
          await rafraichirPlan().catch(() => {});
          synchroniserTout(userId).catch(() => {});
          // Token push : notifications instantanées même app fermée.
          enregistrerTokenPush().catch(() => {});
        }, 0);
      } else if (evenement === "SIGNED_OUT") {
        // Le plan et l'essai du compte précédent ne doivent pas survivre à la
        // déconnexion, sinon le compte suivant en hérite brièvement.
        reinitialiserPlan();
        effacerCacheEssai().catch(() => {});
        AsyncStorage.multiRemove(["abonnement_cache", "config_essai_cache", "prefs_meta_v1"]).catch(() => {});
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Toucher une notification (locale planifiée ou push) ouvre l'écran cible.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((reponse) => {
      const ecran = reponse.notification.request.content.data?.ecran;
      if (typeof ecran === "string" && ecran.startsWith("/")) {
        router.push(ecran as any);
      }
    });
    return () => sub.remove();
  }, []);

  // Vérifie les alertes (stock faible / créances en retard) et planifie
  // une notification locale quotidienne — délivrée même app fermée.
  // DIFFÉRÉ après le premier rendu : ce travail (requêtes DB + réseau +
  // re-planification de notifications) tournait au montage et ralentissait
  // visiblement le démarrage de l'app.
  useEffect(() => {
    const tache = InteractionManager.runAfterInteractions(() => {
      verifierAlertesEtNotifier();
    });
    return () => tache.cancel();
  }, []);

  const [appReady, setAppReady] = useState(false);
  // Police de l'app : le splash natif reste affiché tant qu'elle n'est pas
  // chargée, pour qu'aucun texte n'apparaisse d'abord dans la police système.
  const [policesPretes, erreurPolices] = useFonts(POLICES_A_CHARGER);
  // Animation d'ouverture : joue par-dessus l'app, puis se dissout.
  const [splashAnimeActif, setSplashAnimeActif] = useState(true);

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
      } catch (error) {
        console.error("Erreur initialisation application :", error);
      } finally {
        setAppReady(true);
      }
    }

    prepare();
  }, []);

  // Cache le splash dès que l'app est prête.
  // NE PAS utiliser onLayout : en passant du <View> de chargement au
  // <View> principal (même type de composant), React réutilise la vue
  // native déjà mesurée et onLayout ne se re-déclenche jamais.
  useEffect(() => {
    if (appReady && (policesPretes || erreurPolices)) {
      SplashScreen.hideAsync().catch((error) => {
        console.log("Erreur fermeture splash :", error);
      });
    }
  }, [appReady, policesPretes, erreurPolices]);

  // -------------------------------------------------------
  // Tant que l'application n'est pas prête, on ne rend pas
  // l'interface principale.
  // -------------------------------------------------------
  if (!appReady || !(policesPretes || erreurPolices)) {
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

          // Transitions : glissement latéral fluide (au lieu d'un simple
          // fondu), geste de retour par balayage activé.
          animation: "slide_from_right",
          animationDuration: 300,
          gestureEnabled: true,
        }}
      >
        {/* Outils plein écran : montent du bas, comme une feuille. */}
        <Stack.Screen name="scan-facture/index" options={{ animation: "slide_from_bottom", animationDuration: 340 }} />
        <Stack.Screen name="vente/vocal" options={{ animation: "slide_from_bottom", animationDuration: 340 }} />
        <Stack.Screen name="premium/index" options={{ animation: "slide_from_bottom", animationDuration: 380 }} />
        <Stack.Screen name="(tabs)" options={{ animation: "fade", animationDuration: 260 }} />
      </Stack>

      <PaywallPopup />
      <SyncBanner />
      {splashAnimeActif && <SplashAnime onTermine={() => setSplashAnimeActif(false)} />}
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ToastProvider>
          <LangueProvider>
            <PaysProvider>
              <CategoriesProvider>
                <CurrencyProvider>
                  <AppContent />
                </CurrencyProvider>
              </CategoriesProvider>
            </PaysProvider>
          </LangueProvider>
        </ToastProvider>
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