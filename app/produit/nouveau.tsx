import { useState,useEffect } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, Image } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase/client";
import { usePlanActuel } from "@/lib/plan/usePlanActuel";
import { ecouterSelectionCategorie } from "@/lib/categories/relaisSelection"
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";



type TypeChamp = "texte" | "couleur" | "poids" | "image";

const CHAMPS_SUGGERES: { cle: string; labelCle: string; type: TypeChamp }[] = [
  { cle: "remarque", labelCle: "produit_champ_remarque", type: "texte" },
  { cle: "description", labelCle: "produit_champ_description", type: "texte" },
  { cle: "reference", labelCle: "produit_champ_reference", type: "texte" },
  { cle: "couleur", labelCle: "produit_champ_couleur", type: "couleur" },
  { cle: "poids", labelCle: "produit_champ_poids", type: "poids" },
  { cle: "image", labelCle: "produit_champ_image", type: "image" },
];

const PALETTE_COULEURS = ["#E53935", "#FB8C00", "#FDD835", "#43A047", "#1E88E5", "#8E24AA", "#6D4C41", "#000000", "#FFFFFF", "#9E9E9E"];
const UNITES_POIDS = ["g", "kg", "L", "mL"];

export default function NouveauProduit() {
  const { colors } = useTheme();
  const { langue } = useLangue();



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
  const [imageUri, setImageUri] = useState<string | null>(null);
  const {plan} = usePlanActuel();

  useEffect(() => {
    ecouterSelectionCategorie(setCategorie);
  }, []);
  function basculerChamp(cle: string) {
    setChampsActifs((actuels) => (actuels.includes(cle) ? actuels.filter((c) => c !== cle) : [...actuels, cle]));
  }

  async function choisirImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const resultat = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!resultat.canceled) setImageUri(resultat.assets[0].uri);
  }


  async function sauvegarder() {
    if (!nom.trim() || !prixVente) {
      Alert.alert(t("produit_erreur_titre", langue), t("produit_erreur_texte", langue));
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
  
    if (plan?.quotaProduits) {
      const nb = await database.get("produits").query(Q.where("user_id", user.id)).fetchCount();
      if (nb >= plan.quotaProduits) { router.push("/premium"); return; }
    }
  
    const champsSupplementaires: Record<string, string> = { ...valeursTexte };
    if (champsActifs.includes("couleur") && couleurChoisie) champsSupplementaires.couleur = couleurChoisie;
    if (champsActifs.includes("poids") && poidsValeur) champsSupplementaires.poids = `${poidsValeur} ${poidsUnite}`;
    if (champsActifs.includes("image") && imageUri) champsSupplementaires.image_uri = imageUri;
  
    await database.write(async () => {
      await database.get("produits").create((p: any) => {
        p.userId = user.id;
        p.nom = nom;
        p.categorieNom = categorie || null;
        p.prixVente = Number(prixVente);
        p.prixAchat = Number(prixAchat) || null;
        p.quantiteStock = Number(quantite) || 0;
        p.seuilAlerte = Number(seuilAlerte) || 5;
        p.champsSupplementairesJson = JSON.stringify(champsSupplementaires);
        p.synchronise = false;
      });
    });
    console.log("Produit sauvegardé");
  
    router.back();
  }
  
  
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View style={styles.entete}>
        <Pressable onPress={() => router.back()}>
          <Feather name="x" size={20} color={colors.textSecondary} />
        </Pressable>
        <Text style={{ fontSize: 14, fontWeight: "500", color: colors.textPrimary }}>{t("produit_titre", langue)}</Text>
        <Pressable onPress={sauvegarder}>
          <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "500" }}>{t("produit_sauver", langue)}</Text>
        </Pressable>
      </View>

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
              onChange={(v) => setValeursTexte((prev) => ({ ...prev, [cle]: v }))}
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
          {imageUri ? (
            <Pressable onPress={choisirImage}>
              <Image source={{ uri: imageUri }} style={styles.apercuImage} />
              <Text style={{ fontSize: 11, color: colors.accent, marginTop: 6 }}>{t("produit_changer_image", langue)}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={choisirImage} style={[styles.zoneImage, { borderColor: colors.border }]}>
              <Feather name="camera" size={22} color={colors.textMuted} />
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 6 }}>{t("produit_ajouter_image", langue)}</Text>
            </Pressable>
          )}
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
  zoneImage: { height: 120, borderWidth: 1, borderStyle: "dashed", borderRadius: 12, alignItems: "center", justifyContent: "center" },
  apercuImage: { width: "100%", height: 160, borderRadius: 12 },
});