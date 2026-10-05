import { useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useToast } from "@/lib/toast/ToastProvider";
import { useLangue, t } from "@/lib/i18n";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { CONFIG_SCANNER } from "@/lib/scanner/config";
import { OpenAIEdgeProvider } from "@/lib/scanner/providers/OpenAIEdgeProvider";
import { definirScanEnCours } from "@/lib/scanner/scanEnCours";

// Écran « Scanner une facture » : photo → prétraitement → analyse IA →
// l'écran de validation prend le relais. L'IA n'écrit JAMAIS dans la base :
// elle ne fait que comprendre le document (§2).

const provider = new OpenAIEdgeProvider();

export default function ScannerDocument() {
  const [permission, demanderPermission] = useCameraPermissions();
  const [traitement, setTraitement] = useState(false);
  const [illisible, setIllisible] = useState(false);
  const { langue } = useLangue();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const cameraRef = useRef<CameraView>(null);

  if (!permission) return <View style={{ flex: 1, backgroundColor: "#000" }} />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={{ color: "#fff", marginBottom: 16, textAlign: "center" }}>
          {t("scan_facture_besoin_camera", langue)}
        </Text>
        <Pressable onPress={demanderPermission} style={styles.boutonPermission}>
          <Text style={{ color: "#fff" }}>{t("scan_autoriser", langue)}</Text>
        </Pressable>
      </View>
    );
  }

  // Prétraitement (§13) : assez de résolution pour lire les caractères,
  // sans envoyer une photo de plusieurs Mo à l'IA.
  async function pretraiter(uri: string): Promise<{ base64: string; typeMime: string } | null> {
    try {
      const resultat = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: CONFIG_SCANNER.image.largeurMax } }],
        { compress: CONFIG_SCANNER.image.compression, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!resultat.base64) return null;
      // Image quasi vide (fichier minuscule) = probablement illisible :
      // on n'appelle pas l'IA pour rien.
      if (resultat.base64.length < 8000) return null;
      // Au-delà de la taille max, on recompresse plus fort (en gardant assez
      // de résolution pour lire les caractères).
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

  async function traiterImage(uri: string) {
    setTraitement(true);
    setIllisible(false);

    const image = await pretraiter(uri);
    if (!image) {
      setTraitement(false);
      setIllisible(true);
      return;
    }

    const document = await provider.analyzeDocument({ imageBase64: image.base64, typeMime: image.typeMime });
    setTraitement(false);

    if (!document) {
      // Échec réseau/analyse OU document inexploitable.
      showToast(t("scan_intel_erreur", langue), "error");
      setIllisible(true);
      return;
    }
    if (document.documentType === "unknown" && document.items.length === 0 && document.expenses.length === 0) {
      // L'IA n'a rien pu lire : on propose de reprendre la photo (§13).
      setIllisible(true);
      return;
    }

    definirScanEnCours({ document, imageUri: uri });
    router.push("/scan-facture/validation");
  }

  async function capturer() {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
    if (photo?.uri) await traiterImage(photo.uri);
  }

  async function importerDepuisGalerie() {
    const permissionGalerie = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionGalerie.granted) return;
    const resultat = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (!resultat.canceled) await traiterImage(resultat.assets[0].uri);
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {traitement && (
        <View style={styles.overlayTraitement}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{ color: "#fff", marginTop: 12 }}>{t("scan_intel_analyse", langue)}</Text>
        </View>
      )}

      {!traitement && illisible && (
        <View style={styles.overlayTraitement}>
          <Feather name="camera-off" size={36} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600", marginTop: 14 }}>
            {t("scan_intel_illisible_titre", langue)}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 10, lineHeight: 22, textAlign: "center" }}>
            {t("scan_intel_illisible_conseils", langue)}
          </Text>
          <Pressable onPress={() => setIllisible(false)} style={[styles.boutonPermission, { marginTop: 20, backgroundColor: colors.accent }]}>
            <Text style={{ color: "#fff", fontWeight: "600" }}>{t("scan_intel_reprendre", langue)}</Text>
          </Pressable>
        </View>
      )}

      {!traitement && !illisible && (
        <View style={styles.overlay}>
          <View style={styles.entete}>
            <Pressable onPress={() => router.back()}>
              <Feather name="x" size={22} color="#fff" />
            </Pressable>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "500" }}>{t("scan_intel_titre", langue)}</Text>
            <View style={{ width: 22 }} />
          </View>

          <View style={styles.zoneCadre}>
            <View style={styles.cadre} />
            <Text style={styles.texteAide}>{t("scan_intel_aide", langue)}</Text>
          </View>

          <View style={styles.zoneCapture}>
            <Pressable onPress={importerDepuisGalerie}>
              <Feather name="image" size={24} color="#fff" />
            </Pressable>
            <Pressable onPress={capturer} style={styles.boutonCapture} />
            <View style={{ width: 24 }} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  overlay: { flex: 1, justifyContent: "space-between", padding: 16, paddingTop: 50, paddingBottom: 40 },
  overlayTraitement: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.75)", padding: 32 },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  zoneCadre: { alignItems: "center", justifyContent: "center" },
  cadre: { width: 260, height: 340, borderWidth: 2, borderColor: "#fff", borderRadius: 8, borderStyle: "dashed" },
  texteAide: { color: "#fff", fontSize: 12, marginTop: 12, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  zoneCapture: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30 },
  boutonCapture: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#fff", borderWidth: 4, borderColor: "rgba(255,255,255,0.3)" },
  permissionContainer: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", padding: 24 },
  boutonPermission: { backgroundColor: "#378ADD", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
});
