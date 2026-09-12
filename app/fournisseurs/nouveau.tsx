import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { useLangue, t } from "@/lib/i18n";
import { database } from "@/lib/database";
import { EnteteEcran } from "@/components/UI";
import { obtenirUserId } from "@/lib/auth/userCache";
import { synchroniserPourUtilisateurCourant } from "@/lib/database/sync";
import { enregistrerActivite } from "@/lib/audit/journal";
import { peutEcrire } from "@/lib/trial/gate";
import { afficherPaywall } from "@/lib/trial/paywall";
import { usePays } from "@/lib/pays/PaysProvider";
import { validerTelephone } from "@/lib/pays/validation";

export default function NouveauFournisseur() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { showToast } = useToast();
  const { pays } = usePays();
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [chargement, setChargement] = useState(false);

  async function sauvegarder() {
    if (chargement) return;
    if (!(await peutEcrire())) {
      afficherPaywall(langue, () => router.push("/premium"));
      return;
    }
    if (!nom.trim()) {
      showToast(t("nouvelle_creance_erreur", langue), "error");
      return;
    }
    if (telephone.trim()) {
      const validation = validerTelephone(telephone.trim(), pays);
      if (!validation.valide) {
        showToast(validation.message ?? t("inscription_verifie_numero", langue), "error");
        return;
      }
    }
    setChargement(true);
    const userId = await obtenirUserId();
    if (!userId) return;
    await database.write(async () => {
      await database.get("fournisseurs").create((f: any) => {
        f.userId = userId;
        f.nom = nom.trim();
        f.telephone = telephone.trim() ? `${pays.indicatif}${telephone.replace(/\s/g, "")}` : null;
        f.totalAchats = 0;
        f.montantDu = 0;
        f.creeLe = new Date();
        f.synchronise = false;
      });
    });

    synchroniserPourUtilisateurCourant().catch(() => {});
    await enregistrerActivite("fournisseur", "ajout", `Fournisseur ajouté : ${nom}`);
    setChargement(false);
    showToast(t("toast_enregistre", langue), "success");
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
      <EnteteEcran titre={t("fournisseurs_ajouter", langue)} onRetour={() => router.back()} />

      <Champ label={t("fournisseurs_nom", langue)} valeur={nom} onChange={setNom} colors={colors} />
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>{t("fournisseurs_telephone", langue)}</Text>
      <View style={styles.ligneNumero}>
        <Pressable onPress={() => router.push("/pays")} style={[styles.indicatif, { borderColor: colors.border }]}>
          <Text style={{ fontSize: 14, color: colors.textPrimary }}>{pays.drapeau} {pays.indicatif}</Text>
          <Feather name="chevron-down" size={12} color={colors.textMuted} />
        </Pressable>
        <TextInput
          value={telephone}
          onChangeText={setTelephone}
          placeholder="6XX XXX XXX"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          style={[styles.inputNumero, { borderColor: colors.border, color: colors.textPrimary }]}
        />
      </View>

      </ScrollView>

      <View style={{ padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }}>
        <Pressable onPress={sauvegarder} disabled={chargement} style={[styles.bouton, { backgroundColor: colors.accent, opacity: chargement ? 0.6 : 1 }]}>
          <Feather name="check" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{chargement ? "..." : t("nouvelle_creance_sauver", langue)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Champ({ label, valeur, onChange, colors }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={valeur}
        onChangeText={onChange}
        style={{ borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 50 },
  bouton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 10, marginTop: 10 },
  ligneNumero: { flexDirection: "row", gap: 8, marginBottom: 14 },
  indicatif: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1 },
  inputNumero: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
});