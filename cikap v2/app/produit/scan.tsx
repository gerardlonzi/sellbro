import { useEffect, useRef, useState } from "react";
import { Animated, Easing, View, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "@/components/Texte";
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
  const [lampe, setLampe] = useState(false);
  const insets = useSafeAreaInsets();
  const { width: largeurEcran, height: hauteurEcran } = useWindowDimensions();
  // Le code-barres est lu sur TOUT l'écran : le cadre n'est qu'un repère,
  // très large, pas une zone étroite où il faudrait viser.
  const CADRE_L = largeurEcran - 28;
  const CADRE_H = Math.round((hauteurEcran - insets.top - insets.bottom) * 0.55);
  const balayage = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.timing(balayage, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(balayage, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    boucle.start();
    return () => boucle.stop();
  }, [balayage]);
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
        enableTorch={lampe}
        onBarcodeScanned={surBarcodeScanne}
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "code93", "qr"] }}
      />
      <LinearGradient colors={["rgba(0,0,0,0.55)", "transparent"]} style={styles.degradeHaut} pointerEvents="none" />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} style={styles.degradeBas} pointerEvents="none" />

      <View style={[styles.entete, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.rond}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>{t("scan_titre", langue)}</Text>
        <Pressable onPress={() => setLampe((v) => !v)} hitSlop={10} style={[styles.rond, lampe && { backgroundColor: "#F5B942" }]}>
          <Feather name={lampe ? "zap" : "zap-off"} size={18} color={lampe ? "#2A1D00" : "#fff"} />
        </Pressable>
      </View>

      <View style={styles.zoneCadre} pointerEvents="none">
        <View style={{ width: CADRE_L, height: CADRE_H }}>
          <View style={[styles.coin, { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 20 }]} />
          <View style={[styles.coin, { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 20 }]} />
          <View style={[styles.coin, { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 20 }]} />
          <View style={[styles.coin, { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 20 }]} />
          <Animated.View
            style={[styles.ligneScan, { transform: [{ translateY: balayage.interpolate({ inputRange: [0, 1], outputRange: [10, CADRE_H - 14] }) }] }]}
          >
            <LinearGradient colors={["transparent", "#2FD0AE", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
          </Animated.View>
        </View>
        <Text style={styles.texteAide}>{t("scan_aide", langue)}</Text>
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
  degradeHaut: { position: "absolute", top: 0, left: 0, right: 0, height: 140 },
  degradeBas: { position: "absolute", bottom: 0, left: 0, right: 0, height: 220 },
  entete: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16 },
  rond: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  zoneCadre: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  coin: { position: "absolute", width: 44, height: 44, borderColor: "#2FD0AE" },
  ligneScan: { position: "absolute", left: 10, right: 10, height: 3 },
  texteAide: { color: "#fff", fontSize: 13, fontWeight: "600", marginTop: 18, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  permissionContainer: { flex: 1, paddingTop: 50 },
  boutonRetour: { paddingHorizontal: 16, marginBottom: 8, alignSelf: "flex-start" },
  boutonPermission: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  overlayResultat: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 24 },
  carteResultat: { width: "100%", maxWidth: 360, borderRadius: 16, padding: 20, alignItems: "center" },
  boutonResultat: { paddingVertical: 12, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});