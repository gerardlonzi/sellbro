import { useState,useEffect,useRef } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Image, KeyboardAvoidingView, Platform, Modal } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { useLangue, t } from "@/lib/i18n";
import { usePlanActuel } from "@/lib/plan/usePlanActuel";
import { ecouterSelectionCategorie } from "@/lib/categories/relaisSelection"
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { obtenirUserId } from "@/lib/auth/userCache";
import { synchroniserPourUtilisateurCourant } from "@/lib/database/sync";
import { enregistrerActivite } from "@/lib/audit/journal";
import { enregistrerMouvementStock } from "@/lib/stock/mouvements";
import { peutEcrire } from "@/lib/trial/gate";
import { afficherPaywall } from "@/lib/trial/paywall";



type TypeChamp = "texte" | "couleur" | "poids" | "image";

const CHAMPS_SUGGERES: { cle: string; labelCle: string; type: TypeChamp }[] = [
  { cle: "image", labelCle: "produit_champ_image", type: "image" },
  { cle: "remarque", labelCle: "produit_champ_remarque", type: "texte" },
  { cle: "description", labelCle: "produit_champ_description", type: "texte" },
  { cle: "reference", labelCle: "produit_champ_reference", type: "texte" },
  { cle: "poids", labelCle: "produit_champ_poids", type: "poids" },
  { cle: "couleur", labelCle: "produit_champ_couleur", type: "couleur" },
];

const PALETTE_COULEURS = ["#E53935", "#FB8C00", "#FDD835", "#43A047", "#1E88E5", "#8E24AA", "#6D4C41", "#000000", "#FFFFFF", "#9E9E9E"];
const UNITES_POIDS = ["g", "kg", "L", "mL"];

export default function NouveauProduit() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { showToast } = useToast();



  const [nom, setNom] = useState("");
  const [categorie, setCategorie] = useState("");
  const [prixVente, setPrixVente] = useState("");
  const [prixAchat, setPrixAchat] = useState("");
  const [quantite, setQuantite] = useState("");
  const [seuilAlerte, setSeuilAlerte] = useState("5");
  const [champsActifs, setChampsActifs] = useState<string[]>([]);

  // Chaque type de champ a sa propre forme de valeur.
  const [valeursTexte, setValeursTexte] = useState<Record<string, string>>({});
  const [couleurChoisie, setCouleurChoisie] = useState<string | null>(null);
  const [poidsValeur, setPoidsValeur] = useState("");
  const [poidsUnite, setPoidsUnite] = useState("kg");
  const [images, setImages] = useState<string[]>([]);
  const [chargement, setChargement] = useState(false);
  const [cameraOuverte, setCameraOuverte] = useState(false);
  const [permissionCamera, demanderPermissionCamera] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const {plan} = usePlanActuel();
  const { reference } = useLocalSearchParams<{ reference?: string }>();

  useEffect(() => {
    ecouterSelectionCategorie(setCategorie);
  }, []);

  // Si on arrive d'un scan de code-barres, on pré-remplit la référence.
  useEffect(() => {
    if (reference) {
      setValeursTexte((v) => ({ ...v, reference }));
    }
  }, [reference]);
  function basculerChamp(cle: string) {
    setChampsActifs((actuels) => (actuels.includes(cle) ? actuels.filter((c) => c !== cle) : [...actuels, cle]));
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

  // Capture in-app via expo-camera (fiable sur Android, contrairement à
// ImagePicker.launchCameraAsync qui ouvre une app externe parfois absente).
async function prendrePhoto() {
    if (!permissionCamera?.granted) {
      const res = await demanderPermissionCamera();
      if (!res.granted) {
        // Fallback : on tente quand même l'appareil photo système.
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return;
        const resultat = await ImagePicker.launchCameraAsync({ quality: 0.7 });
        if (!resultat.canceled) {
          setImages((actuel) => [...actuel, resultat.assets[0].uri]);
        }
        return;
      }
    }
    setCameraOuverte(true);
  }

  async function capturerPhoto() {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
    if (photo?.uri) {
      setImages((actuel) => [...actuel, photo.uri]);
    }
    setCameraOuverte(false);
  }


  async function sauvegarder() {
    if (chargement) return;
    if (!(await peutEcrire())) {
      afficherPaywall(langue, () => router.push("/premium"));
      return;
    }
    if (!nom.trim() || !prixVente) {
      showToast(t("produit_erreur_texte", langue), "error");
      return;
    }
    setChargement(true);
    const userId = await obtenirUserId();
    if (!userId) { setChargement(false); return; }

    try {
      if (plan?.quotaProduits) {
        const nb = await database.get("produits").query(Q.where("user_id", userId)).fetchCount();
        if (nb >= plan.quotaProduits) { router.push("/premium"); return; }
      }

      const champsSupplementaires: Record<string, string> = { ...valeursTexte };
      if (champsActifs.includes("couleur") && couleurChoisie) champsSupplementaires.couleur = couleurChoisie;
      if (champsActifs.includes("poids") && poidsValeur) champsSupplementaires.poids = `${poidsValeur} ${poidsUnite}`;
      if (champsActifs.includes("image") && images.length > 0) champsSupplementaires.images = JSON.stringify(images);

      let produitId = "";
      await database.write(async () => {
        const produit = await database.get("produits").create((p: any) => {
          p.userId = userId;
          p.nom = nom;
          p.categorieNom = categorie || null;
          p.prixVente = Number(prixVente);
          p.prixAchat = Number(prixAchat) || null;
          p.quantiteStock = Number(quantite) || 0;
          p.seuilAlerte = Number(seuilAlerte) || 5;
          p.champsSupplementairesJson = JSON.stringify(champsSupplementaires);
          p.creeLe = new Date();
          p.synchronise = false;
        });
        produitId = produit.id;
      });

      // Historique des mouvements : si le produit est créé avec du stock,
      // on enregistre une entrée initiale pour qu'elle apparaisse dans l'historique.
      if (produitId && Number(quantite) > 0) {
        await enregistrerMouvementStock({
          userId,
          produitId,
          type: "achat",
          quantite: Number(quantite),
          raison: t("mouvement_stock_initial", langue),
        });
      }

      console.log("Produit sauvegardé");

      synchroniserPourUtilisateurCourant().catch(() => {});
      await enregistrerActivite("produit", "ajout", `Produit ajouté : ${nom} — stock initial : ${Number(quantite) || 0}`);
      showToast(t("toast_produit_ajoute", langue), "success");
      router.back();
    } finally {
      setChargement(false);
    }
  }
  
  
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}>
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.entete}>
        <Pressable onPress={() => router.back()}>
          <Feather name="x" size={20} color={colors.textSecondary} />
        </Pressable>
        <Text style={{ fontSize: 14, fontWeight: "500", color: colors.textPrimary }}>{t("produit_titre", langue)}</Text>
        <Pressable onPress={sauvegarder} disabled={chargement}>
          <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "500", opacity: chargement ? 0.5 : 1 }}>{t("produit_sauver", langue)}</Text>
        </Pressable>
      </View>

      {reference ? (
        <ChampTexte
          label={t("produit_champ_reference", langue)}
          valeur={valeursTexte.reference ?? ""}
          onChange={(v: string) => setValeursTexte((prev) => ({ ...prev, reference: v }))}
          placeholder=""
        />
      ) : null}

      <ChampTexte label={t("produit_nom_label", langue)} valeur={nom} onChange={setNom} placeholder={t("produit_nom_placeholder", langue)} />

      <Text style={[styles.label, { color: colors.textSecondary }]}>{t("produit_categorie_label", langue)}</Text>
      <Pressable onPress={() => router.push("/categorie")} style={[styles.selecteur, { borderColor: colors.border }]}>
        <Text style={{ color: categorie ? colors.textPrimary : colors.textMuted, fontSize: 14 }}>
          {categorie || t("produit_categorie_choisir", langue)}
        </Text>
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </Pressable>

      <View style={styles.ligneDeuxChamps}>
        <ChampTexte label={t("produit_prix_vente", langue)} valeur={prixVente} onChange={setPrixVente} placeholder="500" numerique style={{ flex: 1 }} />
        <ChampTexte label={t("produit_prix_achat", langue)} valeur={prixAchat} onChange={setPrixAchat} placeholder="350" numerique style={{ flex: 1 }} />
      </View>

      <View style={styles.ligneDeuxChamps}>
        <ChampTexte label={t("produit_quantite", langue)} valeur={quantite} onChange={setQuantite} placeholder="50" numerique style={{ flex: 1 }} />
        <ChampTexte label={t("produit_seuil", langue)} valeur={seuilAlerte} onChange={setSeuilAlerte} placeholder="5" numerique style={{ flex: 1 }} />
      </View>
      {/* Champs texte simples (remarque, description, référence) */}
      {champsActifs
        .filter((cle) => CHAMPS_SUGGERES.find((c) => c.cle === cle)?.type === "texte")
        .map((cle) => {
          const info = CHAMPS_SUGGERES.find((c) => c.cle === cle)!;
          return (
            <ChampTexte
              key={cle}
              label={t(info.labelCle as any, langue)}
              valeur={valeursTexte[cle] ?? ""}
              onChange={(v: string) => setValeursTexte((prev) => ({ ...prev, [cle]: v }))}
              placeholder=""
            />
          );
        })}

      {/* Couleur : vraie palette sélectionnable */}
      {champsActifs.includes("couleur") && (
        <View style={{ marginBottom: 16 }}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t("produit_choisir_couleur", langue)}</Text>
          <View style={styles.paletteCouleurs}>
            {PALETTE_COULEURS.map((couleur) => (
              <Pressable
                key={couleur}
                onPress={() => setCouleurChoisie(couleur)}
                style={[
                  styles.pastilleCouleur,
                  { backgroundColor: couleur, borderColor: couleurChoisie === couleur ? colors.accent : colors.border, borderWidth: couleurChoisie === couleur ? 3 : 1 },
                ]}
              />
            ))}
          </View>
        </View>
      )}

      {/* Poids : valeur numérique + unité */}
      {champsActifs.includes("poids") && (
        <View style={{ marginBottom: 16 }}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t("produit_champ_poids", langue)}</Text>
          <View style={styles.lignePoids}>
            <TextInput
              value={poidsValeur}
              onChangeText={setPoidsValeur}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.textPrimary }]}
            />
            <View style={styles.ligneUnites}>
              {UNITES_POIDS.map((u) => (
                <Pressable
                  key={u}
                  onPress={() => setPoidsUnite(u)}
                  style={[styles.puceUnite, { borderColor: poidsUnite === u ? colors.accent : colors.border, borderWidth: poidsUnite === u ? 2 : 1 }]}
                >
                  <Text style={{ fontSize: 12, color: poidsUnite === u ? colors.accent : colors.textPrimary }}>{u}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}

      {champsActifs.includes("image") && (
        <View style={{ marginBottom: 16 }}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t("produit_champ_image", langue)}</Text>
          <View style={styles.ligneImages}>
            {images.map((uri, i) => (
              <Pressable key={i} onPress={() => setImages((actuel) => actuel.filter((_, idx) => idx !== i))}>
                <Image source={{ uri }} style={styles.miniatureImage} />
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
      )}
      <Text style={[styles.label, { color: colors.textSecondary, marginTop: 8 }]}>{t("produit_champ_facultatif", langue)}</Text>
      <View style={styles.ligneChamps}>
        {CHAMPS_SUGGERES.map((c) => (
          <Pressable
            key={c.cle}
            onPress={() => basculerChamp(c.cle)}
            style={[styles.pucheChamp, { borderColor: champsActifs.includes(c.cle) ? colors.accent : colors.border, borderWidth: champsActifs.includes(c.cle) ? 2 : 1 }]}
          >
            <Feather name={champsActifs.includes(c.cle) ? "check" : "plus"} size={12} color={champsActifs.includes(c.cle) ? colors.accent : colors.textMuted} />
            <Text style={{ color: champsActifs.includes(c.cle) ? colors.accent : colors.textPrimary, fontSize: 12 }}>{t(c.labelCle as any, langue)}</Text>
          </Pressable>
        ))}
      </View>


    </ScrollView>

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
    </KeyboardAvoidingView>
  );
}

function ChampTexte({ label, valeur, onChange, placeholder, numerique, style }: any) {
  const { colors } = useTheme();
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        value={valeur}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={numerique ? "numeric" : "default"}
        style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 50 },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  label: { fontSize: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  selecteur: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 14 },
  ligneDeuxChamps: { flexDirection: "row", gap: 10 },
  ligneChamps: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  pucheChamp: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  paletteCouleurs: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  pastilleCouleur: { width: 34, height: 34, borderRadius: 17 },
  lignePoids: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  ligneUnites: { flexDirection: "row", gap: 6 },
  puceUnite: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8 },
  ligneImages: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  miniatureImage: { width: 80, height: 80, borderRadius: 8 },
  zoneImage: { width: 80, height: 80, borderWidth: 1, borderStyle: "dashed", borderRadius: 8, alignItems: "center", justifyContent: "center" },
  overlayCamera: { flex: 1, justifyContent: "space-between", padding: 16, paddingTop: 50, paddingBottom: 40 },
  boutonFermerCamera: { alignSelf: "flex-start" },
  boutonCaptureCamera: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#fff", borderWidth: 4, borderColor: "rgba(255,255,255,0.3)", alignSelf: "center" },
});