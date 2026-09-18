import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator, Image, Modal } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { useLangue, t } from "@/lib/i18n";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { obtenirUserId } from "@/lib/auth/userCache";
import { enregistrerActivite } from "@/lib/audit/journal";
import { peutEcrire } from "@/lib/trial/gate";
import { afficherPaywall } from "@/lib/trial/paywall";
import { supprimerEnregistrement } from "@/lib/database/supprimer";
import { televerserImagesLocales } from "@/lib/storage/images";
import { calculerBenefice } from "@/lib/ventes/benefice";
import { ImageCachee } from "@/components/ImageCachee";
import { useCurrency } from "@/lib/currency/CurrencyProvider";

export default function DetailProduit() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { showToast } = useToast();
  const { formater } = useCurrency();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [nom, setNom] = useState("");
  const [prixVente, setPrixVente] = useState("");
  const [prixAchat, setPrixAchat] = useState("");
  const [quantite, setQuantite] = useState("");
  const [seuilAlerte, setSeuilAlerte] = useState("");
  const [champsSupp, setChampsSupp] = useState<Record<string, string>>({});
  // Images modifiables : URIs locales (nouvelles) ou URLs distantes (existantes).
  const [images, setImages] = useState<string[]>([]);
  const [cameraOuverte, setCameraOuverte] = useState(false);
  const [permissionCamera, demanderPermissionCamera] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [stats, setStats] = useState({ nbVentes: 0, ca: 0, benefice: 0, topClients: [] as { nom: string; montant: number }[] });

  useEffect(() => {
    charger();
  }, [id]);

  async function charger() {
    setChargement(true);
    const p = (await database.get("produits").find(id)) as any;
    if (p) {
      setNom(p.nom);
      setPrixVente(String(p.prixVente));
      setPrixAchat(p.prixAchat != null ? String(p.prixAchat) : "");
      setQuantite(String(p.quantiteStock));
      setSeuilAlerte(String(p.seuilAlerte));
      setChampsSupp(p.champsSupplementaires ?? {});
      // Charge les images existantes (format multiple `images` ou ancien `image_uri`).
      const cs = p.champsSupplementaires ?? {};
      try {
        setImages(cs.images ? JSON.parse(cs.images) : cs.image_uri ? [cs.image_uri] : []);
      } catch {
        setImages([]);
      }
    }

    // Stats de vente de ce produit.
    const ventes = await database.get("ventes").query(Q.where("produit_id", id)).fetch();
    const ventesList = ventes as any[];
    const nbVentes = ventesList.reduce((s, v) => s + v.quantite, 0);
    const ca = ventesList.reduce((s, v) => s + v.quantite * v.prixUnitaire, 0);
    const clientsMap: Record<string, number> = {};
    for (const v of ventesList) {
      if (v.clientNom) clientsMap[v.clientNom] = (clientsMap[v.clientNom] ?? 0) + v.quantite * v.prixUnitaire;
    }
    const topClients = Object.entries(clientsMap).map(([nom, montant]) => ({ nom, montant })).sort((a, b) => b.montant - a.montant).slice(0, 3);
    // Bénéfice réel : quantité × (prix de vente − prix d'achat de CE produit).
    const produitsParId = new Map([[id, { prixAchat: (p as any)?.prixAchat ?? null }]]);
    setStats({ nbVentes, ca, benefice: calculerBenefice(ventesList, produitsParId), topClients });

    setChargement(false);
  }

  async function ajouterImages() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const resultat = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsMultipleSelection: true,
    });
    if (!resultat.canceled) {
      setImages((actuel) => [...actuel, ...resultat.assets.map((a) => a.uri)]);
    }
  }

  // Capture in-app via expo-camera (comme dans l'écran de création, fiable sur Android).
  async function prendrePhoto() {
    if (!permissionCamera?.granted) {
      const res = await demanderPermissionCamera();
      if (!res.granted) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return;
        const resultat = await ImagePicker.launchCameraAsync({ quality: 0.7 });
        if (!resultat.canceled) setImages((actuel) => [...actuel, resultat.assets[0].uri]);
        return;
      }
    }
    setCameraOuverte(true);
  }

  async function capturerPhoto() {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
    if (photo?.uri) setImages((actuel) => [...actuel, photo.uri]);
    setCameraOuverte(false);
  }

  async function sauvegarder() {
    if (enregistrement) return;
    if (!(await peutEcrire())) {
      afficherPaywall(langue, () => router.push("/premium"));
      return;
    }
    setEnregistrement(true);
    try {
      const p = await database.get("produits").find(id);
      const userId = await obtenirUserId();
      // Téléverse les nouvelles images locales → URLs distantes synchronisables.
      const imagesDistantes = userId ? await televerserImagesLocales(images, "produits", userId) : images;
      const ancien = (p as any);
      const ancienPrix = ancien.prixVente;
      const ancienStock = ancien.quantiteStock;
      const nouveauPrix = Number(prixVente);
      const nouveauStock = Number(quantite) || 0;

      // Met à jour les images dans les champs supplémentaires (supprime
      // l'ancien format `image_uri` au passage).
      const nouveauxChamps = { ...champsSupp };
      delete nouveauxChamps.image_uri;
      if (imagesDistantes.length > 0) nouveauxChamps.images = JSON.stringify(imagesDistantes);
      else delete nouveauxChamps.images;

      await database.write(async () => {
        await (p as any).update((x: any) => {
          x.nom = nom;
          x.prixVente = nouveauPrix;
          x.prixAchat = Number(prixAchat) || null;
          x.quantiteStock = nouveauStock;
          x.seuilAlerte = Number(seuilAlerte) || 5;
          x.champsSupplementairesJson = JSON.stringify(nouveauxChamps);
          x.synchronise = false;
        });
      });
      setChampsSupp(nouveauxChamps);
      setImages(imagesDistantes);

      // Description détaillée de ce qui a changé.
      const changements: string[] = [];
      if (nouveauPrix !== ancienPrix) changements.push(`prix changé de ${ancienPrix} à ${nouveauPrix}`);
      if (nouveauStock !== ancienStock) changements.push(`stock changé de ${ancienStock} à ${nouveauStock}`);
      const description = changements.length > 0
        ? `Produit modifié : ${nom} — ${changements.join(", ")}`
        : `Produit modifié : ${nom}`;

      await enregistrerActivite("produit", "modification", description);
      showToast(t("toast_produit_modifie", langue), "success");
      router.back();
    } finally {
      setEnregistrement(false);
    }
  }

  function confirmerSuppression() {
    Alert.alert(t("categories_supprimer_confirmer", langue), "", [
      { text: t("popup_non", langue), style: "cancel" },
      {
        text: t("categories_supprimer_confirmer", langue),
        style: "destructive",
        onPress: async () => {
          if (enregistrement) return;
          setEnregistrement(true);
          try {
            const p = await database.get("produits").find(id);
            await database.write(async () => { await supprimerEnregistrement("produits", p as any); });
            await enregistrerActivite("produit", "suppression", `Produit supprimé : ${nom}`);
            showToast(t("toast_produit_supprime", langue), "success");
            router.back();
          } finally {
            setEnregistrement(false);
          }
        },
      },
    ]);
  }

  if (chargement) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
      <View style={styles.entete}>
        <Pressable onPress={() => router.back()}>
          <Feather name="x" size={20} color={colors.textSecondary} />
        </Pressable>
        <Text style={{ fontSize: 14, fontWeight: "500", color: colors.textPrimary }}>{nom}</Text>
        <Pressable onPress={() => router.push(`/produit/mouvements/${id}`)} style={{ marginLeft: 12 }}>
  <Feather name="clock" size={18} color={colors.textSecondary} />
</Pressable>
      </View>

      {/* Statistiques du produit */}
      <View style={[styles.blocChamps, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Statistiques</Text>
        <View style={styles.ligneChamp}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Ventes</Text>
          <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{stats.nbVentes}</Text>
        </View>
        <View style={styles.ligneChamp}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Chiffre d'affaires</Text>
          <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{formater(stats.ca)}</Text>
        </View>
        <View style={styles.ligneChamp}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Bénéfice estimé</Text>
          <Text style={{ color: colors.success, fontSize: 13, fontWeight: "500" }}>{formater(stats.benefice)}</Text>
        </View>
        {stats.topClients.length > 0 && (
          <View style={{ marginTop: 6 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Meilleurs clients</Text>
            {stats.topClients.map((c) => (
              <View key={c.nom} style={styles.ligneChamp}>
                <Text style={{ color: colors.textPrimary, fontSize: 12 }}>{c.nom}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{formater(c.montant)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Images : modifiables — toucher une miniature la supprime. */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>{t("produit_champ_image", langue)}</Text>
        <View style={styles.ligneImages}>
          {images.map((uri, i) => (
            <Pressable key={`${uri}-${i}`} onPress={() => setImages((actuel) => actuel.filter((_, idx) => idx !== i))}>
              <ImageCachee uri={uri} style={styles.miniatureImage} />
              <View style={[styles.badgeSupprImage, { backgroundColor: colors.danger }]}>
                <Feather name="x" size={10} color="#fff" />
              </View>
            </Pressable>
          ))}
          <Pressable onPress={prendrePhoto} style={[styles.zoneImage, { borderColor: colors.border }]}>
            <Feather name="camera" size={22} color={colors.textMuted} />
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>{t("produit_prendre_photo", langue)}</Text>
          </Pressable>
          <Pressable onPress={ajouterImages} style={[styles.zoneImage, { borderColor: colors.border }]}>
            <Feather name="plus" size={22} color={colors.textMuted} />
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>{t("produit_ajouter_image", langue)}</Text>
          </Pressable>
        </View>
      </View>

      {Object.keys(champsSupp).length > 0 && (
        <View style={[styles.blocChamps, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {champsSupp.couleur ? (
            <View style={styles.ligneChamp}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t("produit_champ_couleur", langue)}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={[styles.pastilleCouleur, { backgroundColor: champsSupp.couleur }]} />
                <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{champsSupp.couleur}</Text>
              </View>
            </View>
          ) : null}
          {champsSupp.poids ? (
            <View style={styles.ligneChamp}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t("produit_champ_poids", langue)}</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{champsSupp.poids}</Text>
            </View>
          ) : null}
          {champsSupp.remarque ? (
            <View style={styles.ligneChamp}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t("produit_champ_remarque", langue)}</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{champsSupp.remarque}</Text>
            </View>
          ) : null}
          {champsSupp.description ? (
            <View style={styles.ligneChamp}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t("produit_champ_description", langue)}</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{champsSupp.description}</Text>
            </View>
          ) : null}
          {champsSupp.reference ? (
            <View style={styles.ligneChamp}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t("produit_champ_reference", langue)}</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{champsSupp.reference}</Text>
            </View>
          ) : null}
        </View>
      )}

      <Champ label={t("produit_nom_label", langue)} valeur={nom} onChange={setNom} colors={colors} />
      <View style={styles.ligneDeux}>
        <Champ label={t("produit_prix_vente", langue)} valeur={prixVente} onChange={setPrixVente} numerique colors={colors} style={{ flex: 1 }} />
        <Champ label={t("produit_prix_achat", langue)} valeur={prixAchat} onChange={setPrixAchat} numerique colors={colors} style={{ flex: 1 }} />
      </View>
      <View style={styles.ligneDeux}>
        <Champ label={t("produit_quantite", langue)} valeur={quantite} onChange={setQuantite} numerique colors={colors} style={{ flex: 1 }} />
        <Champ label={t("produit_seuil", langue)} valeur={seuilAlerte} onChange={setSeuilAlerte} numerique colors={colors} style={{ flex: 1 }} />
      </View>

      <Pressable onPress={confirmerSuppression} style={[styles.boutonSupprimer, { backgroundColor: colors.dangerBg, marginTop: 20 }]}>
        <Feather name="trash-2" size={15} color={colors.danger} />
        <Text style={{ color: colors.danger, fontSize: 13, fontWeight: "500" }}>{t("categories_supprimer_confirmer", langue)}</Text>
      </Pressable>
    </ScrollView>

      <View style={{ padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }}>
        <Pressable onPress={sauvegarder} disabled={enregistrement} style={{ backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 10, alignItems: "center", opacity: enregistrement ? 0.6 : 1 }}>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{enregistrement ? "..." : t("produit_sauver", langue)}</Text>
        </Pressable>
      </View>

      <Modal visible={cameraOuverte} animationType="slide" onRequestClose={() => setCameraOuverte(false)}>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          {permissionCamera?.granted && (
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
          )}
          <View style={styles.overlayCamera}>
            <Pressable onPress={() => setCameraOuverte(false)} style={styles.boutonFermerCamera}>
              <Feather name="x" size={22} color="#fff" />
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={capturerPhoto} style={styles.boutonCaptureCamera} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Champ({ label, valeur, onChange, numerique, colors, style }: any) {
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={valeur}
        onChangeText={onChange}
        keyboardType={numerique ? "numeric" : "default"}
        style={{ borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 50 },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  ligneDeux: { flexDirection: "row", gap: 10 },
  boutonSupprimer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 8 },
  imageProduit: { width: "100%", height: 160, borderRadius: 12, marginBottom: 16 },
  ligneImages: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  miniatureImage: { width: 80, height: 80, borderRadius: 8 },
  badgeSupprImage: { position: "absolute", top: -5, right: -5, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  zoneImage: { width: 80, height: 80, borderWidth: 1, borderStyle: "dashed", borderRadius: 8, alignItems: "center", justifyContent: "center" },
  overlayCamera: { flex: 1, justifyContent: "space-between", padding: 16, paddingTop: 50, paddingBottom: 40 },
  boutonFermerCamera: { alignSelf: "flex-start" },
  boutonCaptureCamera: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#fff", borderWidth: 4, borderColor: "rgba(255,255,255,0.3)", alignSelf: "center" },
  blocChamps: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 },
  ligneChamp: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  pastilleCouleur: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: "#00000022" },
});