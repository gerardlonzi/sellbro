import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/Texte";
import { PressableAnime, usePulsation } from "@/components/anim";
import { useToast } from "@/lib/toast/ToastProvider";
import { useLangue, t } from "@/lib/i18n";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { CONFIG_SCANNER } from "@/lib/scanner/config";
import { OpenAIEdgeProvider } from "@/lib/scanner/providers/OpenAIEdgeProvider";
import { definirScanEnCours } from "@/lib/scanner/scanEnCours";
import { chargerCandidatsProduits } from "@/lib/scanner/candidats";
import { obtenirUserId } from "@/lib/auth/userCache";
import { useAccesIA } from "@/lib/ia/useAccesIA";
import { peutEcrire } from "@/lib/trial/gate";
import { afficherPaywall } from "@/lib/trial/paywall";

// Écran « Scanner une facture » : photo → prétraitement → analyse IA →
// écran de validation. L'IA n'écrit JAMAIS dans la base : elle ne fait que
// comprendre le document ; l'utilisateur valide ensuite.

const provider = new OpenAIEdgeProvider();

export default function ScannerDocument() {
  const [permission, demanderPermission] = useCameraPermissions();
  const [traitement, setTraitement] = useState(false);
  const [illisible, setIllisible] = useState(false);
  const [lampe, setLampe] = useState(false);
  const { langue } = useLangue();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const { width: largeurEcran, height: hauteurEcran } = useWindowDimensions();
  // Cadre quasi plein écran : on peut photographier un document entier (A4,
  // long ticket) sans le viser dans un petit carré. Les marges laissent la
  // place à l'en-tête et aux commandes.
  const CADRE_L = largeurEcran - 28;
  const CADRE_H = hauteurEcran - (insets.top + 70) - (Math.max(insets.bottom, 16) + 210);
  const cameraRef = useRef<CameraView>(null);
  const { accesScan } = useAccesIA();

  // Ligne de balayage qui monte et descend dans le cadre.
  const balayage = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.timing(balayage, { toValue: 1, duration: traitement ? 900 : 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(balayage, { toValue: 0, duration: traitement ? 900 : 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    boucle.start();
    return () => boucle.stop();
  }, [balayage, traitement]);
  const declencheur = usePulsation(!traitement, 1600, 0, 1);

  // Message de progression pendant l'analyse.
  const [etapeTexte, setEtapeTexte] = useState(0);
  useEffect(() => {
    if (!traitement) return setEtapeTexte(0);
    const id = setInterval(() => setEtapeTexte((n) => (n + 1) % 3), 2600);
    return () => clearInterval(id);
  }, [traitement]);

  if (!permission) return <View style={{ flex: 1, backgroundColor: "#000" }} />;

  if (!permission.granted) {
    return (
      <View style={[styles.permission, { backgroundColor: colors.background }]}>
        <View style={[styles.iconePermission, { backgroundColor: colors.accentBg }]}>
          <Feather name="camera" size={34} color={colors.accent} />
        </View>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "800", marginTop: 20, textAlign: "center" }}>{t("scan_intel_titre", langue)}</Text>
        <Text style={{ color: colors.textSecondary, marginTop: 8, marginBottom: 24, textAlign: "center", lineHeight: 21 }}>{t("scan_facture_besoin_camera", langue)}</Text>
        <PressableAnime onPress={demanderPermission}>
          <LinearGradient colors={[colors.accentClair, colors.accent]} style={styles.boutonPermission}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>{t("scan_autoriser", langue)}</Text>
          </LinearGradient>
        </PressableAnime>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.textMuted }}>{t("scan_quitter", langue)}</Text>
        </Pressable>
      </View>
    );
  }

  // Prétraitement : assez de résolution pour lire les caractères, sans envoyer
  // une photo de plusieurs Mo.
  async function pretraiter(uri: string): Promise<{ base64: string; typeMime: string } | null> {
    try {
      const resultat = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: CONFIG_SCANNER.image.largeurMax } }], {
        compress: CONFIG_SCANNER.image.compression,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      });
      if (!resultat.base64) return null;
      // Fichier quasi vide = photo noire / illisible : on n'appelle pas l'IA.
      if (resultat.base64.length < 8000) return null;
      if (resultat.base64.length * 0.75 > CONFIG_SCANNER.image.tailleMaxOctets) {
        const plusLegere = await ImageManipulator.manipulateAsync(
          resultat.uri,
          [{ resize: { width: Math.round(CONFIG_SCANNER.image.largeurMax * 0.7) } }],
          { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        if (plusLegere.base64) return { base64: plusLegere.base64, typeMime: "image/jpeg" };
      }
      return { base64: resultat.base64, typeMime: "image/jpeg" };
    } catch {
      return null;
    }
  }

  async function verifierAcces(): Promise<boolean> {
    // Accès IA (Premium ou essai actif) ET écriture autorisée : sinon paywall
    // AVANT la photo. Le quota est re-vérifié côté serveur.
    if (!accesScan || !(await peutEcrire())) {
      afficherPaywall(langue, () => router.push("/premium"), { raison: "ia" });
      return false;
    }
    return true;
  }

  async function traiterImage(uri: string) {
    setTraitement(true);
    setIllisible(false);

    const image = await pretraiter(uri);
    if (!image) {
      // Échec de préparation sur l'appareil : on ne prétend PAS que la photo est floue.
      setTraitement(false);
      showToast(t("scan_image_non_traitee", langue), "error");
      return;
    }

    // Contexte (§20) : seulement quelques noms de produits pour aider l'IA à
    // lire les libellés — jamais toute la base.
    const userId = await obtenirUserId();
    const candidats = userId ? await chargerCandidatsProduits(userId).catch(() => []) : [];
    const resultat = await provider.analyzeDocument({ imageBase64: image.base64, typeMime: image.typeMime, contexte: { candidatsProduits: candidats } });
    setTraitement(false);

    if (!resultat.ok) {
      // Chaque cause a son message : on ne dit « floue » que si l'IA l'a constaté.
      if (resultat.erreur === "reserve") {
        afficherPaywall(langue, () => router.push("/premium"), { raison: "ia" });
      } else if (resultat.erreur === "quota") {
        showToast(t("scan_quota_epuise", langue), "error");
        afficherPaywall(langue, () => router.push("/premium"));
      } else if (resultat.erreur === "hors_ligne") {
        showToast(t("erreur_ia_hors_ligne", langue), "error");
      } else if (resultat.erreur === "session") {
        showToast(t("erreur_ia_session", langue), "error");
      } else {
        showToast(t("erreur_ia_serveur", langue), "error");
      }
      return;
    }

    const { document, scanId } = resultat;
    if (document.documentType === "unknown" && document.items.length === 0 && document.expenses.length === 0) {
      // Rien d'exploitable : on explique avec la cause jugée par l'IA, sinon un
      // message neutre (sans accuser la photo).
      const cause = document.imageIssue;
      const cle =
        cause === "blurry" ? "scan_flou"
        : cause === "dark" ? "scan_sombre"
        : cause === "cropped" ? "scan_incomplet"
        : cause === "not_a_document" ? "scan_pas_document"
        : "scan_rien_detecte";
      showToast(t(cle, langue), "error");
      setIllisible(true);
      return;
    }

    definirScanEnCours({ document, imageUri: uri, scanId, source: "scan" });
    router.push("/scan-facture/validation");
  }

  async function capturer() {
    if (!cameraRef.current || traitement) return;
    if (!(await verifierAcces())) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
    if (photo?.uri) await traiterImage(photo.uri);
  }

  async function importerDepuisGalerie() {
    if (traitement) return;
    if (!(await verifierAcces())) return;
    const permissionGalerie = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionGalerie.granted) return;
    const resultat = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (!resultat.canceled) await traiterImage(resultat.assets[0].uri);
  }

  const messagesAnalyse = [t("scan_intel_analyse", langue), t("scan_etape_produits", langue), t("scan_etape_montants", langue)];
  const coin = (style: object) => <View style={[styles.coin, style]} />;

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" enableTorch={lampe} />

      {/* Dégradés légers en haut et en bas : lisibilité des commandes, sans masquer l'image */}
      <LinearGradient colors={["rgba(0,0,0,0.55)", "transparent"]} style={styles.degradeHaut} pointerEvents="none" />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.7)"]} style={styles.degradeBas} pointerEvents="none" />

      {/* En-tête */}
      <View style={[styles.entete, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.rond}>
          <Feather name="x" size={20} color="#fff" />
        </Pressable>
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>{t("scan_intel_titre", langue)}</Text>
        <Pressable onPress={() => setLampe((v) => !v)} hitSlop={10} style={[styles.rond, lampe && { backgroundColor: "#F5B942" }]}>
          <Feather name="zap" size={18} color={lampe ? "#2A1D00" : "#fff"} />
        </Pressable>
      </View>

      {/* Cadre + coins + ligne de balayage */}
      <View style={[styles.zoneCadre, { top: insets.top + 60, bottom: Math.max(insets.bottom, 16) + 200 }]} pointerEvents="none">
        <View style={{ width: CADRE_L, height: CADRE_H }}>
          {coin({ top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 })}
          {coin({ top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 })}
          {coin({ bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 18 })}
          {coin({ bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 18 })}
          <Animated.View style={[styles.ligneScan, { transform: [{ translateY: balayage.interpolate({ inputRange: [0, 1], outputRange: [8, CADRE_H - 12] }) }] }]}>
            <LinearGradient colors={["rgba(47,208,174,0)", "#2FD0AE", "rgba(47,208,174,0)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
          </Animated.View>
        </View>
      </View>

      {/* Conseils */}
      {!traitement && !illisible && (
        <View style={styles.conseils} pointerEvents="none">
          {[["layers", "scan_conseil_1"], ["sun", "scan_conseil_2"], ["maximize", "scan_conseil_3"]].map(([ic, cle]) => (
            <View key={cle} style={styles.conseil}>
              <Feather name={ic as any} size={12} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 11.5, fontWeight: "600" }}>{t(cle as any, langue)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Commandes */}
      {!traitement && !illisible && (
        <View style={[styles.commandes, { paddingBottom: Math.max(insets.bottom, 16) + 14 }]}>
          <Pressable onPress={importerDepuisGalerie} style={styles.cmdLateral}>
            <View style={styles.rondGrand}>
              <Feather name="image" size={22} color="#fff" />
            </View>
            <Text style={styles.cmdLibelle}>{t("scan_galerie", langue)}</Text>
          </Pressable>

          <View style={styles.zoneDeclencheur}>
            <Animated.View style={[styles.haloDeclencheur, { opacity: declencheur.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: declencheur.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }] }]} />
            <PressableAnime onPress={capturer} echelle={0.9}>
              <View style={styles.declencheurExt}>
                <View style={styles.declencheurInt} />
              </View>
            </PressableAnime>
          </View>

          <View style={styles.cmdLateral} />
        </View>
      )}

      {/* Analyse en cours */}
      {traitement && (
        <View style={styles.overlay}>
          <LinearGradient colors={["rgba(7,24,21,0.55)", "rgba(7,24,21,0.9)"]} style={StyleSheet.absoluteFill} />
          <Animated.View style={{ transform: [{ scale: declencheur.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>
            <LinearGradient colors={["#2FD0AE", "#14917A"]} style={styles.orbeAnalyse}>
              <Feather name="file-text" size={34} color="#fff" />
            </LinearGradient>
          </Animated.View>
          <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800", marginTop: 22 }}>{messagesAnalyse[etapeTexte]}</Text>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12.5, marginTop: 6 }}>{t("scan_attente", langue)}</Text>
        </View>
      )}

      {/* Document difficile à lire */}
      {!traitement && illisible && (
        <View style={styles.overlay}>
          <LinearGradient colors={["rgba(7,24,21,0.8)", "rgba(7,24,21,0.95)"]} style={StyleSheet.absoluteFill} />
          <View style={styles.orbeIllisible}>
            <Feather name="camera-off" size={32} color="#fff" />
          </View>
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 20, textAlign: "center" }}>{t("scan_intel_illisible_titre", langue)}</Text>
          <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13.5, marginTop: 12, lineHeight: 23, textAlign: "center" }}>{t("scan_intel_illisible_conseils", langue)}</Text>
          <PressableAnime onPress={() => setIllisible(false)} style={{ marginTop: 24 }}>
            <LinearGradient colors={["#2FD0AE", "#14917A"]} style={styles.boutonPermission}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>{t("scan_intel_reprendre", langue)}</Text>
            </LinearGradient>
          </PressableAnime>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  degradeHaut: { position: "absolute", top: 0, left: 0, right: 0, height: 150 },
  degradeBas: { position: "absolute", bottom: 0, left: 0, right: 0, height: 320 },
  entete: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16 },
  rond: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  zoneCadre: { position: "absolute", left: 0, right: 0, alignItems: "center", justifyContent: "center" },
  coin: { position: "absolute", width: 38, height: 38, borderColor: "#2FD0AE" },
  ligneScan: { position: "absolute", left: 6, right: 6, height: 3 },
  conseils: { position: "absolute", left: 0, right: 0, bottom: 168, flexDirection: "row", justifyContent: "center", gap: 8, paddingHorizontal: 12 },
  conseil: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20 },
  commandes: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 34, paddingTop: 16 },
  cmdLateral: { width: 64, alignItems: "center", gap: 6 },
  rondGrand: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  cmdLibelle: { color: "#fff", fontSize: 11.5, fontWeight: "600" },
  zoneDeclencheur: { width: 92, height: 92, alignItems: "center", justifyContent: "center" },
  haloDeclencheur: { position: "absolute", width: 78, height: 78, borderRadius: 39, backgroundColor: "#fff" },
  declencheurExt: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  declencheurInt: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#fff" },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: 32 },
  orbeAnalyse: { width: 92, height: 92, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  orbeIllisible: { width: 76, height: 76, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  permission: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  iconePermission: { width: 84, height: 84, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  boutonPermission: { paddingHorizontal: 28, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
