import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  useAudioRecorder,
  RecordingPresets,
  AudioModule,
} from "expo-audio";

import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { transcrireAudio } from "@/lib/ai/voice";

const DUREE_MAX = 15;

type Etape =
  | "attente"
  | "enregistrement"
  | "traitement"
  | "resultat";

export default function EnregistrementVocal() {
  const { colors } = useTheme();
  const { langue } = useLangue();

  const [etape, setEtape] = useState<Etape>("attente");
  const [tempsRestant, setTempsRestant] = useState(DUREE_MAX);
  const [texteTranscrit, setTexteTranscrit] = useState("");

  const recorder = useAudioRecorder(
    RecordingPresets.HIGH_QUALITY
  );

  // ---------------------------------------------------------
  // Timer du compte à rebours
  // ---------------------------------------------------------
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  // ---------------------------------------------------------
  // Timer de l'animation des barres
  // ---------------------------------------------------------
  const animationRef =
    useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------
  // Empêche arreter() d'être exécuté plusieurs fois
  // ---------------------------------------------------------
  const arretEnCoursRef = useRef(false);

  // ---------------------------------------------------------
  // Barres audio
  // ---------------------------------------------------------
  const barres = useRef(
    Array.from(
      { length: 20 },
      () => new Animated.Value(6)
    )
  ).current;

  // =========================================================
  // NETTOYAGE DU TIMER
  // =========================================================

  function nettoyerTimer() {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  // =========================================================
  // ANIMATION DES BARRES AUDIO
  // =========================================================

  useEffect(() => {
    if (etape !== "enregistrement") {
      if (animationRef.current !== null) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }

      return;
    }

    animationRef.current = setInterval(() => {
      barres.forEach((barre) => {
        Animated.timing(barre, {
          toValue: 6 + Math.random() * 34,
          duration: 120,
          useNativeDriver: false,
        }).start();
      });
    }, 120);

    return () => {
      if (animationRef.current !== null) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [etape, barres]);

  // =========================================================
  // COMPTE À REBOURS
  // =========================================================

  useEffect(() => {
    // On ne fait rien si on n'enregistre pas
    if (etape !== "enregistrement") {
      nettoyerTimer();
      return;
    }

    // On s'assure qu'il n'existe pas déjà un timer
    nettoyerTimer();

    timerRef.current = setInterval(() => {
      setTempsRestant((ancienTemps) => {
        // ---------------------------------------------------
        // Temps terminé
        // ---------------------------------------------------
        if (ancienTemps <= 1) {
          nettoyerTimer();

          // On déclenche l'arrêt après le rendu courant.
          setTimeout(() => {
            arreter();
          }, 0);

          return 0;
        }

        return ancienTemps - 1;
      });
    }, 1000);

    return () => {
      nettoyerTimer();
    };
  }, [etape]);

  // =========================================================
  // NETTOYAGE LORSQUE L'ÉCRAN EST DÉTRUIT
  // =========================================================

  useEffect(() => {
    return () => {
      nettoyerTimer();

      if (animationRef.current !== null) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
    };
  }, []);

  // =========================================================
  // DÉMARRER L'ENREGISTREMENT
  // =========================================================

  async function demarrer() {
    try {
      const permission =
        await AudioModule.requestRecordingPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "",
          "Autorise l'accès au micro pour utiliser cette fonctionnalité."
        );
        return;
      }

      // Réinitialisation
      nettoyerTimer();

      arretEnCoursRef.current = false;

      setTempsRestant(DUREE_MAX);
      setTexteTranscrit("");

      // Préparation
      await recorder.prepareToRecordAsync();

      // Démarrage
      recorder.record();

      // On passe à l'étape d'enregistrement
      setEtape("enregistrement");
    } catch (error) {
      console.error(
        "Erreur démarrage enregistrement :",
        error
      );

      setEtape("attente");

      Alert.alert(
        "",
        "Impossible de démarrer l'enregistrement."
      );
    }
  }

  // =========================================================
  // ARRÊTER L'ENREGISTREMENT
  // =========================================================

  async function arreter() {
    // Évite un double appel
    if (arretEnCoursRef.current) {
      return;
    }

    arretEnCoursRef.current = true;

    // Stop du compte à rebours
    nettoyerTimer();

    // Passage immédiat à traitement
    setEtape("traitement");

    try {
      await recorder.stop();

      const uri = recorder.uri;

      if (!uri) {
        setEtape("attente");

        Alert.alert(
          "",
          "L'enregistrement a échoué, réessaie."
        );

        arretEnCoursRef.current = false;
        return;
      }

      // Transcription
      const texte = await transcrireAudio(uri);

      if (!texte) {
        setEtape("attente");

        Alert.alert(
          "",
          "Impossible de traiter l'enregistrement — vérifie ta connexion ou ton quota."
        );

        arretEnCoursRef.current = false;
        return;
      }

      setTexteTranscrit(texte);

      // Résultat
      setEtape("resultat");

      arretEnCoursRef.current = false;
    } catch (error) {
      console.error(
        "Erreur arrêt/transcription :",
        error
      );

      setEtape("attente");

      Alert.alert(
        "",
        "Une erreur est survenue pendant le traitement."
      );

      arretEnCoursRef.current = false;
    }
  }

  // =========================================================
  // RECOMMENCER
  // =========================================================

  function recommencer() {
    nettoyerTimer();

    arretEnCoursRef.current = false;

    setTexteTranscrit("");
    setTempsRestant(DUREE_MAX);
    setEtape("attente");
  }

  // =========================================================
  // VALIDER
  // =========================================================

  function valider() {
    router.replace({
      pathname: "/vente/confirmation",
      params: {
        source: "vocal",
        texteExtrait: texteTranscrit,
      },
    });
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      {/* Fermer */}
      <Pressable
        onPress={() => {
          nettoyerTimer();
          router.back();
        }}
        style={styles.closeButton}
      >
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 18,
          }}
        >
          ✕
        </Text>
      </Pressable>

      {/* Titre */}
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: 15,
          fontWeight: "500",
          marginBottom: 30,
        }}
      >
        Décris ta vente
      </Text>

      {/* =====================================================
          ATTENTE
      ====================================================== */}

      {etape === "attente" && (
        <View style={styles.center}>
          <Pressable
            onPress={demarrer}
            style={[
              styles.boutonPrincipal,
              {
                backgroundColor: colors.accent,
              },
            ]}
          >
            <Feather
              name="mic"
              size={28}
              color="#fff"
            />
          </Pressable>

          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 13,
              marginTop: 20,
            }}
          >
            {t(
              "vocal_appuyer_pour_parler",
              langue
            )}
          </Text>
        </View>
      )}

      {/* =====================================================
          ENREGISTREMENT
      ====================================================== */}

      {etape === "enregistrement" && (
        <View style={styles.center}>
          {/* Barres */}
          <View style={styles.ligneBarres}>
            {barres.map((barre, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.barre,
                  {
                    height: barre,
                    backgroundColor: colors.accent,
                  },
                ]}
              />
            ))}
          </View>

          {/* Compteur */}
          <Text
            style={[
              styles.compteur,
              {
                color: colors.textPrimary,
              },
            ]}
          >
            {tempsRestant}s
          </Text>

          <Text
            style={{
              color: colors.accent,
              fontSize: 13,
              marginTop: 16,
            }}
          >
            {t("vocal_en_cours", langue)}
          </Text>

          {/* Stop */}
          <Pressable
            onPress={arreter}
            style={[
              styles.boutonStop,
              {
                backgroundColor: colors.danger,
              },
            ]}
          >
            <Text
              style={{
                color: "#fff",
                fontSize: 18,
              }}
            >
              ■
            </Text>
          </Pressable>
        </View>
      )}

      {/* =====================================================
          TRAITEMENT
      ====================================================== */}

      {etape === "traitement" && (
        <View
          style={[
            styles.center,
            {
              paddingVertical: 40,
            },
          ]}
        >
          <ActivityIndicator
            size="large"
            color={colors.accent}
          />

          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 13,
              marginTop: 16,
            }}
          >
            Traitement en cours...
          </Text>
        </View>
      )}

      {/* =====================================================
          RESULTAT
      ====================================================== */}

      {etape === "resultat" && (
        <View style={styles.resultat}>
          <Text
            style={{
              fontSize: 13,
              color: colors.textSecondary,
              marginBottom: 10,
            }}
          >
            {t(
              "vocal_transcription_titre",
              langue
            )}
          </Text>

          <View
            style={[
              styles.carteTranscription,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={{
                fontSize: 15,
                color: colors.textPrimary,
                lineHeight: 22,
              }}
            >
              {texteTranscrit}
            </Text>
          </View>

          <View
            style={{
              gap: 10,
              marginTop: 24,
            }}
          >
            {/* Valider */}
            <Pressable
              onPress={valider}
              style={[
                styles.boutonLarge,
                {
                  backgroundColor: colors.accent,
                },
              ]}
            >
              <Feather
                name="check"
                size={16}
                color="#fff"
              />

              <Text
                style={{
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                {t("vocal_valider", langue)}
              </Text>
            </Pressable>

            {/* Recommencer */}
            <Pressable
              onPress={recommencer}
              style={[
                styles.boutonLarge,
                {
                  borderColor: colors.border,
                  borderWidth: 1,
                },
              ]}
            >
              <Feather
                name="rotate-ccw"
                size={15}
                color={colors.textPrimary}
              />

              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 14,
                }}
              >
                {t("vocal_reessayer", langue)}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// =========================================================
// STYLES
// =========================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
    alignItems: "center",
  },

  closeButton: {
    alignSelf: "flex-start",
    marginBottom: 20,
  },

  center: {
    alignItems: "center",
  },

  boutonPrincipal: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  ligneBarres: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 50,
  },

  barre: {
    width: 4,
    borderRadius: 2,
  },

  compteur: {
    fontSize: 24,
    fontWeight: "500",
    marginTop: 16,
  },

  boutonStop: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },

  resultat: {
    width: "100%",
  },

  carteTranscription: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    minHeight: 100,
  },

  boutonLarge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
  },
});