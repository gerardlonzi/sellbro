import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { obtenirUserId } from "@/lib/auth/userCache";

// Scanner un code-barres pour retrouver (ou créer) un produit du stock.
// La correspondance se fait sur le champ "référence" du produit.
export default function ScannerProduit() {
  const [permission, demanderPermission] = useCameraPermissions();
  const [verrouille, setVerrouille] = useState(false);

  if (!permission) return <View style={{ flex: 1, backgroundColor: "#000" }} />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={{ color: "#fff", marginBottom: 16, textAlign: "center" }}>
          Boutika a besoin d'accéder à ta caméra pour scanner les codes-barres
        </Text>
        <Pressable onPress={demanderPermission} style={styles.boutonPermission}>
          <Text style={{ color: "#fff" }}>Autoriser la caméra</Text>
        </Pressable>
      </View>
    );
  }

  async function surBarcodeScanne({ data }: { data: string }) {
    if (verrouille) return;
    setVerrouille(true);

    const userId = await obtenirUserId();
    if (!userId) { setVerrouille(false); return; }

    const resultats = await database.get("produits").query(Q.where("user_id", userId)).fetch();
    const produit = (resultats as any[]).find((p) => p.champsSupplementaires?.reference === data);

    if (produit) {
      router.replace(`/produit/${produit.id}`);
    } else {
      Alert.alert("Produit introuvable", `Aucun produit avec la référence ${data}`, [
        { text: "Annuler", style: "cancel", onPress: () => setVerrouille(false) },
        { text: "Créer le produit", onPress: () => router.replace({ pathname: "/produit/nouveau", params: { reference: data } }) },
      ]);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={surBarcodeScanne}
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "code93", "qr"] }}
      />
      <View style={styles.overlay}>
        <View style={styles.entete}>
          <Pressable onPress={() => router.back()}>
            <Feather name="x" size={22} color="#fff" />
          </Pressable>
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "500" }}>Scanner un code-barres</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.zoneCadre}>
          <View style={styles.cadre} />
          <Text style={styles.texteAide}>Aligne le code-barres dans le cadre</Text>
        </View>

        <View />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "space-between", padding: 16, paddingTop: 50, paddingBottom: 40 },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  zoneCadre: { alignItems: "center", justifyContent: "center" },
  cadre: { width: 280, height: 160, borderWidth: 2, borderColor: "#fff", borderRadius: 8, borderStyle: "dashed" },
  texteAide: { color: "#fff", fontSize: 12, marginTop: 12, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  permissionContainer: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", padding: 24 },
  boutonPermission: { backgroundColor: "#378ADD", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
});