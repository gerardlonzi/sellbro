import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAudioRecorder, RecordingPresets, AudioModule } from "expo-audio";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, TextInput } from "@/components/Texte";
import { Apparition, PressableAnime, usePulsation } from "@/components/anim";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { transcrireAudio } from "@/lib/ai/voice";
import { useAccesIA } from "@/lib/ia/useAccesIA";
import { peutEcrire } from "@/lib/trial/gate";
import { afficherPaywall } from "@/lib/trial/paywall";
import { obtenirUserId } from "@/lib/auth/userCache";
import { chargerCatalogue } from "@/lib/scanner/candidats";
import { chargerAlias } from "@/lib/scanner/aliases";
import { documentDepuisTranscription } from "@/lib/ai/parserVocal";
import { definirScanEnCours } from "@/lib/scanner/scanEnCours";

// Vente à la voix : enregistrement (15 s max) → transcription IA → l'écran de
// VALIDATION (le même que le scan de factures). Le texte transcrit peut être
// corrigé avant de continuer ; rien n'est enregistré sans validation.
const DUREE_MAX = 15;
type Etape = "attente" | "enregistrement" | "traitement" | "resultat";
const NB_BARRES = 24;

export default function EnregistrementVocal() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const insets = useSafeAreaInsets();
  const { accesVocal } = useAccesIA();

  const [etape, setEtape] = useState<Etape>("attente");
  const [tempsRestant, setTempsRestant] = useState(DUREE_MAX);
  const [texte, setTexte] = useState("");
  const [preparation, setPreparation] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const arretEnCours = useRef(false);
  const minuteur = useRef<ReturnType<typeof setInterval> | null>(null);

  const enregistre = etape === "enregistrement";
  const anneaux = usePulsation(enregistre || etape === "attente", enregistre ? 900 : 1700, 0, 1);

  // Barres de la forme d'onde : transformation d'échelle (driver natif).
  const barres = useRef(Array.from({ length: NB_BARRES }, () => new Animated.Value(0.18))).current;
  useEffect(() => {
    if (!enregistre) {
      barres.forEach((b) => b.setValue(0.18));
      return;
    }
    const boucles = barres.map((b, i) => {
      const boucle = Animated.loop(
        Animated.sequence([
          Animated.timing(b, { toValue: 0.25 + Math.random() * 0.75, duration: 260 + (i % 5) * 70, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(b, { toValue: 0.12 + Math.random() * 0.3, duration: 260 + (i % 4) * 90, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );
      boucle.start();
      return boucle;
    });
    return () => boucles.forEach((b) => b.stop());
  }, [enregistre, barres]);

  function arreterMinuteur() {
    if (minuteur.current) clearInterval(minuteur.current);
    minuteur.current = null;
  }

  // Compte à rebours pendant l'enregistrement.
  useEffect(() => {
    if (etape !== "enregistrement") return;
    minuteur.current = setInterval(() => {
      setTempsRestant((n) => {
        if (n <= 1) {
          arreterMinuteur();
          setTimeout(arreter, 0);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return arreterMinuteur;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etape]);

  useEffect(() => arreterMinuteur, []);

  async function demarrer() {
    // Accès IA (Premium ou essai actif) + écriture autorisée.
    if (!accesVocal || !(await peutEcrire())) {
      afficherPaywall(langue, () => router.push("/premium"), { raison: "ia" });
      return;
    }
    try {
      setPreparation(true);
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("", t("vocal_permission", langue));
        return;
      }
      arreterMinuteur();
      arretEnCours.current = false;
      setTempsRestant(DUREE_MAX);
      setTexte("");
      await recorder.prepareToRecordAsync();
      recorder.record();
      setEtape("enregistrement");
    } catch (e) {
      console.warn("Erreur démarrage enregistrement :", e);
      setEtape("attente");
      Alert.alert("", t("vocal_erreur_demarrage", langue));
    } finally {
      setPreparation(false);
    }
  }

  async function arreter() {
    if (arretEnCours.current) return;
    arretEnCours.current = true;
    arreterMinuteur();
    setEtape("traitement");
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        setEtape("attente");
        Alert.alert("", t("vocal_erreur_enregistrement", langue));
        arretEnCours.current = false;
        return;
      }
      const r = await transcrireAudio(uri, langue === "en" ? "en" : "fr");
      if (!r.ok) {
        setEtape("attente");
        arretEnCours.current = false;
        // Message = vraie cause, pour ne pas faire répéter l'utilisateur pour rien.
        if (r.erreur === "reserve") afficherPaywall(langue, () => router.push("/premium"), { raison: "ia" });
        else if (r.erreur === "quota") Alert.alert("", t("vocal_quota_epuise", langue));
        else if (r.erreur === "hors_ligne") Alert.alert("", t("erreur_ia_hors_ligne", langue));
        else if (r.erreur === "session") Alert.alert("", t("erreur_ia_session", langue));
        else if (r.erreur === "silence") Alert.alert("", t("vocal_silence", langue));
        else Alert.alert("", t("erreur_ia_serveur", langue));
        return;
      }
      setTexte(r.texte);
      setEtape("resultat");
      arretEnCours.current = false;
    } catch (e) {
      console.warn("Erreur arrêt/transcription :", e);
      setEtape("attente");
      Alert.alert("", t("vocal_erreur_generique", langue));
      arretEnCours.current = false;
    }
  }

  function recommencer() {
    arreterMinuteur();
    arretEnCours.current = false;
    setTexte("");
    setTempsRestant(DUREE_MAX);
    setEtape("attente");
  }

  // Transcription → document structuré (matching LOCAL contre le catalogue et
  // les alias) → écran de validation.
  async function continuer() {
    const userId = await obtenirUserId();
    const [catalogue, alias] = userId ? await Promise.all([chargerCatalogue(userId), chargerAlias(userId)]) : [[], []];
    const document = documentDepuisTranscription(texte, catalogue, alias);
    definirScanEnCours({ document, imageUri: "", source: "vocal" });
    router.replace("/scan-facture/validation");
  }

  const couleurOrbe: [string, string] = enregistre ? ["#FF7A70", "#E0463D"] : [colors.accentClair, colors.accent];
  const mm = String(Math.floor(tempsRestant / 60)).padStart(2, "0");
  const ss = String(tempsRestant % 60).padStart(2, "0");

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={[colors.accentBg, colors.background]} style={[StyleSheet.absoluteFill, { height: "55%" }]} pointerEvents="none" />

      <View style={[styles.entete, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => {
            arreterMinuteur();
            router.back();
          }}
          hitSlop={10}
          style={[styles.rond, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Feather name="x" size={18} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "800" }}>{t("vocal_titre", langue)}</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {etape !== "resultat" && (
          <View style={styles.centre}>
            {etape !== "traitement" && (
              <Apparition>
                <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: "center", paddingHorizontal: 32, lineHeight: 19 }}>{t("vocal_exemple", langue)}</Text>
              </Apparition>
            )}

            <View style={styles.zoneOrbe}>
              {[0, 1].map((i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.anneau,
                    {
                      borderColor: enregistre ? "#FF7A70" : colors.accentClair,
                      opacity: anneaux.interpolate({ inputRange: [0, 1], outputRange: i === 0 ? [0.5, 0] : [0.3, 0] }),
                      transform: [{ scale: anneaux.interpolate({ inputRange: [0, 1], outputRange: i === 0 ? [1, 1.9] : [1.15, 2.3] }) }],
                    },
                  ]}
                />
              ))}
              <PressableAnime onPress={etape === "attente" ? demarrer : etape === "enregistrement" ? arreter : () => {}} disabled={preparation || etape === "traitement"} echelle={0.93}>
                <LinearGradient colors={couleurOrbe} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.orbe}>
                  {etape === "traitement" ? <Feather name="loader" size={38} color="#fff" /> : <Feather name={enregistre ? "square" : "mic"} size={enregistre ? 30 : 40} color="#fff" />}
                </LinearGradient>
              </PressableAnime>
            </View>

            {enregistre && (
              <View style={styles.forme}>
                {barres.map((b, i) => (
                  <Animated.View key={i} style={[styles.barre, { backgroundColor: colors.accent, transform: [{ scaleY: b }] }]} />
                ))}
              </View>
            )}

            {enregistre && (
              <>
                <Text style={{ color: colors.textPrimary, fontSize: 40, fontWeight: "800", letterSpacing: -1, marginTop: 6 }}>{mm}:{ss}</Text>
                <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "700", marginTop: 4 }}>{t("vocal_toucher_arreter", langue)}</Text>
              </>
            )}
            {etape === "attente" && <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: "700", marginTop: 14 }}>{t("vocal_appuyer_pour_parler", langue)}</Text>}
            {etape === "traitement" && <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: "600", marginTop: 14 }}>{t("vocal_traitement", langue)}</Text>}
          </View>
        )}

        {etape === "resultat" && (
          <View style={styles.resultat}>
            <Apparition>
              <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", color: colors.textMuted, marginBottom: 10 }}>{t("vocal_transcription_titre", langue)}</Text>
              <View style={[styles.carteTexte, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Feather name="message-circle" size={16} color={colors.accent} style={{ marginBottom: 8 }} />
                <TextInput value={texte} onChangeText={setTexte} multiline style={{ color: colors.textPrimary, fontSize: 17, lineHeight: 25, fontWeight: "500", minHeight: 80, textAlignVertical: "top" }} />
              </View>
            </Apparition>
            <Apparition delai={140}>
              <View style={{ gap: 10, marginTop: 22 }}>
                <PressableAnime onPress={continuer} disabled={!texte.trim()} style={{ opacity: texte.trim() ? 1 : 0.5 }}>
                  <LinearGradient colors={[colors.accentClair, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.boutonLarge}>
                    <Feather name="check" size={18} color="#fff" />
                    <Text style={{ color: "#fff", fontSize: 15.5, fontWeight: "800" }}>{t("vocal_continuer", langue)}</Text>
                  </LinearGradient>
                </PressableAnime>
                <PressableAnime onPress={recommencer} style={[styles.boutonLarge, { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }]}>
                  <Feather name="rotate-ccw" size={16} color={colors.textPrimary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 14.5, fontWeight: "700" }}>{t("vocal_reessayer", langue)}</Text>
                </PressableAnime>
              </View>
            </Apparition>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  rond: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 40 },
  zoneOrbe: { width: 220, height: 220, alignItems: "center", justifyContent: "center", marginVertical: 24 },
  anneau: { position: "absolute", width: 120, height: 120, borderRadius: 60, borderWidth: 2 },
  orbe: { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center", elevation: 10, shadowColor: "#14917A", shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  forme: { flexDirection: "row", alignItems: "center", gap: 4, height: 50 },
  barre: { width: 4, height: 48, borderRadius: 2 },
  resultat: { flex: 1, padding: 20, paddingTop: 28 },
  carteTexte: { borderWidth: 1, borderRadius: 20, padding: 18 },
  boutonLarge: { height: 54, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
