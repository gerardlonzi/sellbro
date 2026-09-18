import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Image } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { EnteteEcran, BoutonPrimaire } from "@/components/UI";
import { supabase } from "@/lib/supabase/client";
import { avecTimeout } from "@/lib/timeout";
import { televerserImage } from "@/lib/storage/images";
import { ImageCachee } from "@/components/ImageCachee";
import { usePays } from "@/lib/pays/PaysProvider";

export default function InfosBoutique() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { pays } = usePays();
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [secteur, setSecteur] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    charger();
  }, []);

  async function charger() {
    let logoDistant: string | null = null;
    try {
      // Timeout : hors ligne, getUser peut rester pendu et figer l'écran.
      const {
        data: { user },
      } = await avecTimeout(supabase.auth.getUser(), 5000);
      if (user) {
        const { data } = await avecTimeout(supabase.from("profiles").select("*").eq("id", user.id).single(), 5000);
        if (data) {
          setNom(data.nom_boutique ?? "");
          setTelephone(data.telephone ?? "");
          setEmail(data.email ?? user.email ?? "");
          setSecteur(data.secteur ?? "");
          // Le logo distant (URL Storage) prime : il suit l'utilisateur sur tous
          // ses appareils. Le cache local ne sert que de secours hors ligne.
          logoDistant = data.logo_url ?? null;
        }
      }
    } catch {
      // Hors ligne : valeurs locales ci-dessous.
    }
    const nomLocal = await AsyncStorage.getItem("boutika_nom_boutique");
    if (nomLocal && !nom) setNom(nomLocal);
    if (logoDistant) {
      setLogo(logoDistant);
      await AsyncStorage.setItem("boutika_logo", logoDistant);
    } else {
      const logoSauvegarde = await AsyncStorage.getItem("boutika_logo");
      if (logoSauvegarde) setLogo(logoSauvegarde);
    }
  }

  async function choisirLogo() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const resultat = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
    });
    if (!resultat.canceled && resultat.assets[0]?.base64) {
      const ext = resultat.assets[0].uri.split(".").pop()?.toLowerCase() === "png" ? "png" : "jpeg";
      setLogo(`data:image/${ext};base64,${resultat.assets[0].base64}`);
    }
  }

  async function sauvegarder() {
    if (chargement) return;
    setChargement(true);
    try {
      await AsyncStorage.setItem("boutika_nom_boutique", nom);
      const {
        data: { user },
      } = await avecTimeout(supabase.auth.getUser(), 5000).catch(() => ({ data: { user: null } }));
      // Logo : un logo local (data:) est téléversé vers Storage ; on ne garde
      // que l'URL distante, synchronisée via profiles.logo_url.
      let logoFinal = logo;
      if (logo && user) {
        const url = await televerserImage(logo, "logos", user.id);
        if (url) logoFinal = url;
      }
      if (logoFinal) await AsyncStorage.setItem("boutika_logo", logoFinal);
      // Copie base64 pour le PDF (fonctionne hors ligne, contrairement à l'URL).
      if (logo?.startsWith("data:")) await AsyncStorage.setItem("boutika_logo_base64", logo);
      setLogo(logoFinal);
      if (user) {
        await supabase
          .from("profiles")
          .update({
            nom_boutique: nom.trim() || null,
            telephone: telephone.trim() || null,
            secteur: secteur.trim() || null,
            logo_url: logoFinal,
          })
          .eq("id", user.id);
      }
      router.back();
    } finally {
      setChargement(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <EnteteEcran titre={t("boutique_reglage_titre", langue)} onRetour={() => router.back()} />

      <Pressable onPress={choisirLogo} style={{ alignItems: "center", marginBottom: 16 }}>
        {logo ? (
          <ImageCachee uri={logo} style={styles.logo} />
        ) : (
          <View style={[styles.logo, styles.logoVide, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="camera" size={22} color={colors.textMuted} />
          </View>
        )}
        <Text style={{ color: colors.accent, fontSize: 12, marginTop: 8 }}>{logo ? "Changer le logo" : "Ajouter un logo"}</Text>
      </Pressable>

      <Text style={[styles.label, { color: colors.textSecondary }]}>{t("boutique_nom_label", langue)}</Text>
      <TextInput value={nom} onChangeText={setNom} placeholder="Ex: Boutique Awa" placeholderTextColor={colors.textMuted} style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]} />

      <Text style={[styles.label, { color: colors.textSecondary }]}>{t("label_email", langue)}</Text>
      <TextInput value={email} editable={false} style={[styles.input, { borderColor: colors.border, color: colors.textMuted }]} />

      <Text style={[styles.label, { color: colors.textSecondary }]}>{t("boutique_telephone_label", langue)}</Text>
      <View style={styles.ligneNumero}>
        <Pressable onPress={() => router.push("/pays")} style={[styles.indicatif, { borderColor: colors.border }]}>
          <Text style={{ fontSize: 14 }}>{pays.drapeau} {pays.indicatif}</Text>
          <Feather name="chevron-down" size={12} color={colors.textMuted} />
        </Pressable>
        <TextInput
          value={telephone.replace(pays.indicatif, "")}
          onChangeText={(v) => setTelephone(`${pays.indicatif}${v.replace(/\s/g, "")}`)}
          placeholder="6XX XXX XXX"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, flex: 1 }]}
        />
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>{t("boutique_secteur_label", langue)}</Text>
      <TextInput value={secteur} onChangeText={setSecteur} placeholder="Ex: Alimentation" placeholderTextColor={colors.textMuted} style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]} />

      <View style={{ marginTop: 20 }}>
        <BoutonPrimaire texte={t("produit_sauver", langue)} onPress={sauvegarder} disabled={chargement} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, paddingTop: 50 },
  label: { fontSize: 12, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  ligneNumero: { flexDirection: "row", gap: 8 },
  indicatif: { justifyContent: "center", paddingHorizontal: 10, borderWidth: 1, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  logo: { width: 84, height: 84, borderRadius: 16 },
  logoVide: { borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
});