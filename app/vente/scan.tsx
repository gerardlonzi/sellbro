import { useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { scannerFacture } from "@/lib/ai/ocr";

export default function ScanFacture() {
  const [permission, demanderPermission] = useCameraPermissions();
  const [traitement, setTraitement] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) return <View style={{ flex: 1, backgroundColor: "#000" }} />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={{ color: "#fff", marginBottom: 16, textAlign: "center" }}>
          Boutika a besoin d'accéder à ta caméra pour scanner les factures
        </Text>
        <Pressable onPress={demanderPermission} style={styles.boutonPermission}>
          <Text style={{ color: "#fff" }}>Autoriser la caméra</Text>
        </Pressable>
      </View>
    );
  }

  async function traiterImage(uri: string) {
    setTraitement(true);
    const texte = await scannerFacture(uri);
    setTraitement(false);

    if (!texte) {
      Alert.alert("", "Impossible de traiter l'image — vérifie ta connexion ou ton quota.");
      return;
    }

    router.replace({ pathname: "/vente/confirmation", params: { source: "scan", texteExtrait: texte } });
  }

  async function capturer() {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
    if (photo?.uri) await traiterImage(photo.uri);
  }

  async function importerDepuisGalerie() {
    const permissionGalerie = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionGalerie.granted) return;

    const resultat = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!resultat.canceled) await traiterImage(resultat.assets[0].uri);
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {traitement && (
        <View style={styles.overlayTraitement}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{ color: "#fff", marginTop: 12 }}>Analyse en cours...</Text>
        </View>
      )}

      {!traitement && (
        <View style={styles.overlay}>
          <View style={styles.entete}>
            <Pressable onPress={() => router.back()}>
              <Feather name="x" size={22} color="#fff" />
            </Pressable>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "500" }}>Scanner une facture</Text>
            <View style={{ width: 22 }} />
          </View>

          <View style={styles.zoneCadre}>
            <View style={styles.cadre} />
            <Text style={styles.texteAide}>Aligne la facture dans le cadre</Text>
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
  overlayTraitement: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)" },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  zoneCadre: { alignItems: "center", justifyContent: "center" },
  cadre: { width: 260, height: 340, borderWidth: 2, borderColor: "#fff", borderRadius: 8, borderStyle: "dashed" },
  texteAide: { color: "#fff", fontSize: 12, marginTop: 12, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  zoneCapture: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30 },
  boutonCapture: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#fff", borderWidth: 4, borderColor: "rgba(255,255,255,0.3)" },
  permissionContainer: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", padding: 24 },
  boutonPermission: { backgroundColor: "#378ADD", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
});