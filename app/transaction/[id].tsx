import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { supabase } from "@/lib/supabase/client";
import { EnteteEcran } from "@/components/UI";

type Vente = {
  id: string; quantite: number; prix_unitaire: number; client_nom: string | null;
  mode_paiement: string | null; source: string; audio_url: string | null; created_at: string;
};

export default function DetailTransaction() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { formater } = useCurrency();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vente, setVente] = useState<Vente | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    charger();
  }, [id]);

  async function charger() {
    setChargement(true);
    const { data } = await supabase.from("ventes").select("*").eq("id", id).single();
    setVente(data);
    setChargement(false);
  }

  async function supprimer() {
    Alert.alert(t("categories_supprimer_confirmer", langue), "", [
      { text: t("popup_non", langue), style: "cancel" },
      {
        text: t("categories_supprimer_confirmer", langue),
        style: "destructive",
        onPress: async () => {
          await supabase.from("ventes").delete().eq("id", id);
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

  if (!vente) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
        <EnteteEcran titre="—" onRetour={() => router.back()} />
      </View>
    );
  }

  const total = vente.quantite * vente.prix_unitaire;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16, paddingTop: 50 }}>
      <EnteteEcran titre={t("commandes_titre", langue)} onRetour={() => router.back()} />

      <View style={{ alignItems: "center", paddingVertical: 16 }}>
        <Text style={{ fontSize: 26, fontWeight: "700", color: colors.textPrimary }}>{formater(total)}</Text>
        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
          {new Date(vente.created_at).toLocaleString(langue === "fr" ? "fr-FR" : "en-US")}
        </Text>
      </View>

      <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ligne label={t("nouvelle_creance_montant", langue)} valeur={`${vente.quantite} × ${vente.prix_unitaire.toLocaleString()} F`} colors={colors} />
        <Ligne label={t("nouvelle_creance_personne", langue)} valeur={vente.client_nom ?? "—"} colors={colors} dernier />
      </View>

      <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
        <Ligne label={t("commandes_paiement_tous", langue) && "Paiement"} valeur={vente.mode_paiement ?? "—"} colors={colors} />
        <Ligne
          label="Source"
          valeur=""
          colors={colors}
          icone={vente.source === "vocal" ? "mic" : vente.source === "scan" ? "camera" : "edit-3"}
          dernier
        />
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
        <Pressable style={[styles.boutonAction, { borderColor: colors.border, borderWidth: 1 }]} onPress={() => {}}>
          <Feather name="edit-3" size={15} color={colors.textPrimary} />
          <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{t("produit_sauver", langue) === "Save" ? "Edit" : "Modifier"}</Text>
        </Pressable>
        <Pressable style={[styles.boutonAction, { backgroundColor: colors.dangerBg }]} onPress={supprimer}>
          <Feather name="trash-2" size={15} color={colors.danger} />
          <Text style={{ color: colors.danger, fontSize: 13 }}>{t("categories_supprimer_confirmer", langue)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Ligne({ label, valeur, colors, icone, dernier }: any) {
  return (
    <View style={[styles.ligne, !dernier && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Text style={{ fontSize: 13, color: colors.textSecondary }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {icone && <Feather name={icone} size={13} color={colors.textMuted} />}
        <Text style={{ fontSize: 13, fontWeight: "500", color: colors.textPrimary }}>{valeur}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderWidth: 1, borderRadius: 12, padding: 16 },
  ligne: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  boutonAction: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 8 },
});