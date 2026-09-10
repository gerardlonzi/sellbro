import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { obtenirUserId } from "@/lib/auth/userCache";

// Scanner un code-barres pour retrouver (ou créer) un produit du stock.
// La correspondance se fait sur le champ "référence" du produit.
export default function ScannerProduit() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const [permission, demanderPermission] = useCameraPermissions();
  const [verrouille, setVerrouille] = useState(false);
  const [resultat, setResultat] = useState<{ type: "trouve"; produitId: string; nom: string; reference: string } | { type: "introuvable"; reference: string } | null>(null);

  if (!permission) return <View style={{ flex: 1, backgroundColor: "#000" }} />;

  if (!permission.granted) {
    return (
      <View style={[styles.permissionContainer, { backgroundColor: colors.background }]}>
        <Pressable onPress={() => router.back()} style={styles.boutonRetour}>
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ color: colors.textPrimary, marginBottom: 16, textAlign: "center" }}>
            {t("scan_permission_message", langue)}
          </Text>
          <Pressable onPress={demanderPermission} style={[styles.boutonPermission, { backgroundColor: colors.accent }]}>
            <Text style={{ color: "#fff" }}>{t("scan_autoriser", langue)}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  async function surBarcodeScanne({ data }: { data: string }) {
    if (verrouille || resultat) return;
    setVerrouille(true);

    const userId = await obtenirUserId();
    if (!userId) { setVerrouille(false); return; }

    const resultats = await database.get("produits").query(Q.where("user_id", userId)).fetch();
    const produit = (resultats as any[]).find((p) => p.champsSupplementaires?.reference === data);

    if (produit) {
      setResultat({ type: "trouve", produitId: produit.id, nom: produit.nom, reference: data });
    } else {
      setResultat({ type: "introuvable", reference: data });
    }
  }

  function reinitialiser() {
    setResultat(null);
    setVerrouille(false);
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
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Feather name="arrow-left" size={24} color="#fff" />
          </Pressable>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{t("scan_titre", langue)}</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.zoneCadre}>
          <View style={styles.cadre} />
          <Text style={styles.texteAide}>{t("scan_aide", langue)}</Text>
        </View>

        <View />
      </View>

      {resultat && (
        <View style={styles.overlayResultat}>
          <View style={[styles.carteResultat, { backgroundColor: colors.surface }]}>
            <Feather name={resultat.type === "trouve" ? "check-circle" : "alert-circle"} size={34} color={resultat.type === "trouve" ? colors.success : colors.warning} />
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "600", marginTop: 10, textAlign: "center" }}>
              {resultat.type === "trouve" ? t("scan_succes", langue) : t("scan_produit_introuvable", langue)}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4, textAlign: "center" }}>
              {resultat.type === "trouve" ? resultat.nom : `${t("scan_aucune_reference", langue)} ${resultat.reference}`}
            </Text>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 18 }}>
              <Pressable onPress={reinitialiser} style={[styles.boutonResultat, { borderColor: colors.border, borderWidth: 1, flex: 1 }]}>
                <Text style={{ color: colors.textPrimary, fontSize: 13, textAlign: "center" }}>{t("scan_autre_image", langue)}</Text>
              </Pressable>
              {resultat.type === "trouve" ? (
                <Pressable onPress={() => router.replace(`/produit/${resultat.produitId}`)} style={[styles.boutonResultat, { backgroundColor: colors.accent, flex: 1 }]}>
                  <Text style={{ color: "#fff", fontSize: 13, textAlign: "center" }}>{t("scan_voir", langue)}</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => router.replace({ pathname: "/produit/nouveau", params: { reference: resultat.reference } })} style={[styles.boutonResultat, { backgroundColor: colors.accent, flex: 1 }]}>
                  <Text style={{ color: "#fff", fontSize: 13, textAlign: "center" }}>{t("scan_creer_produit", langue)}</Text>
                </Pressable>
              )}
            </View>

            <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("scan_quitter", langue)}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "space-between", padding: 16, paddingTop: 50, paddingBottom: 40 },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  zoneCadre: { alignItems: "center", justifyContent: "center" },
  cadre: { width: 280, height: 160, borderWidth: 2, borderColor: "#fff", borderRadius: 8, borderStyle: "dashed" },
  texteAide: { color: "#fff", fontSize: 12, marginTop: 12, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  permissionContainer: { flex: 1, paddingTop: 50 },
  boutonRetour: { paddingHorizontal: 16, marginBottom: 8, alignSelf: "flex-start" },
  boutonPermission: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  overlayResultat: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 24 },
  carteResultat: { width: "100%", maxWidth: 360, borderRadius: 16, padding: 20, alignItems: "center" },
  boutonResultat: { paddingVertical: 12, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});