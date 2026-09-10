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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        setNom(data.nom_boutique ?? "");
        setTelephone(data.telephone ?? "");
        setEmail(data.email ?? user.email ?? "");
        setSecteur(data.secteur ?? "");
      }
    }
    const nomLocal = await AsyncStorage.getItem("boutika_nom_boutique");
    if (nomLocal && !nom) setNom(nomLocal);
    const logoSauvegarde = await AsyncStorage.getItem("boutika_logo");
    if (logoSauvegarde) setLogo(logoSauvegarde);
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
      if (logo) await AsyncStorage.setItem("boutika_logo", logo);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({
            nom_boutique: nom.trim() || null,
            telephone: telephone.trim() || null,
            secteur: secteur.trim() || null,
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
          <Image source={{ uri: logo }} style={styles.logo} />
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