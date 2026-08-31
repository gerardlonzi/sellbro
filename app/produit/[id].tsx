import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase/client";

export default function DetailProduit() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [chargement, setChargement] = useState(true);
  const [nom, setNom] = useState("");
  const [prixVente, setPrixVente] = useState("");
  const [prixAchat, setPrixAchat] = useState("");
  const [quantite, setQuantite] = useState("");
  const [seuilAlerte, setSeuilAlerte] = useState("");

  useEffect(() => {
    charger();
  }, [id]);

  async function charger() {
    setChargement(true);
    const { data } = await supabase.from("produits").select("*").eq("id", id).single();
    if (data) {
      setNom(data.nom);
      setPrixVente(String(data.prix_vente));
      setPrixAchat(data.prix_achat ? String(data.prix_achat) : "");
      setQuantite(String(data.quantite_stock));
      setSeuilAlerte(String(data.seuil_alerte));
    }
    setChargement(false);
  }

  async function sauvegarder() {
    await supabase
      .from("produits")
      .update({
        nom,
        prix_vente: Number(prixVente),
        prix_achat: Number(prixAchat) || null,
        quantite_stock: Number(quantite) || 0,
        seuil_alerte: Number(seuilAlerte) || 5,
      })
      .eq("id", id);
    router.back();
  }

  function confirmerSuppression() {
    Alert.alert(t("categories_supprimer_confirmer", langue), "", [
      { text: t("popup_non", langue), style: "cancel" },
      {
        text: t("categories_supprimer_confirmer", langue),
        style: "destructive",
        onPress: async () => {
          await supabase.from("produits").delete().eq("id", id);
          router.back();
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
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View style={styles.entete}>
        <Pressable onPress={() => router.back()}>
          <Feather name="x" size={20} color={colors.textSecondary} />
        </Pressable>
        <Text style={{ fontSize: 14, fontWeight: "500", color: colors.textPrimary }}>{nom}</Text>
        <Pressable onPress={sauvegarder}>
          <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "500" }}>{t("produit_sauver", langue)}</Text>
        </Pressable>
        <Pressable onPress={() => router.push(`/produit/mouvements/${id}`)} style={{ marginLeft: 12 }}>
  <Feather name="clock" size={18} color={colors.textSecondary} />
</Pressable>
      </View>

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
});