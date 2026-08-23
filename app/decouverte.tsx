import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { LinearGradient } from "expo-linear-gradient";


export default function Decouverte() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { type } = useLocalSearchParams<{ type: "vocal" | "scan" }>();
  const estVocal = type !== "scan";

  type Teinte = "accent" | "success" | "pro";


  function couleursTeinte(teinte: Teinte) {
    if (teinte === "success") return { fond: colors.successBg, forte: colors.success, onForte: colors.background };
    if (teinte === "pro") return { fond: colors.proBg, forte: colors.proFill, onForte: colors.onPro };
    return { fond: colors.accentBg, forte: colors.accent, onForte: colors.background };
  }

  const teinteActive = couleursTeinte("pro");



  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Pressable onPress={() => router.back()} style={styles.fermer}>
        <Feather name="x" size={22} color={colors.textSecondary} />
      </Pressable>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.badgePro, { backgroundColor: colors.proBg }]}>
          <Feather name="star" size={11} color={colors.pro} />
          <Text style={{ fontSize: 11, color: colors.pro, fontWeight: "600" }}>PREMIUM</Text>
        </View>

        {estVocal ? <AperçuVocal colors={colors} langue={langue} /> : <AperçuScan colors={colors} langue={langue} />}

        <Text style={{ fontSize: 20, fontWeight: "700", color: colors.textPrimary, textAlign: "center", marginTop: 24, marginBottom: 10 }}>
          {estVocal ? t("decouverte_titre_vocal", langue) : t("decouverte_titre_scan", langue)}
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 22, paddingHorizontal: 12 }}>
          {estVocal ? t("decouverte_texte_vocal", langue) : t("decouverte_texte_scan", langue)}
        </Text>
      </ScrollView>

      <View style={[styles.bas, { borderTopColor: colors.border }]}>
        <Pressable onPress={() => router.push("/premium")} style={[styles.boutonPrincipal, { backgroundColor: colors.proFill }]}>
          <Feather name="star" size={15} color={colors.onPro} />
          <Text style={{ color: colors.onPro, fontSize: 14, fontWeight: "600" }}>{t("decouverte_bouton", langue)}</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ paddingVertical: 12, alignItems: "center" }}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("decouverte_plus_tard", langue)}</Text>
        </Pressable>
      </View>
      <LinearGradient
        colors={[`${teinteActive.forte}00`, `${teinteActive.forte}60`]}
        style={styles.degrade}
        pointerEvents="none"
      />

    </View>
  );
}

function CarteTelephone({ colors, children }: any) {
  return <View style={[styles.carteTelephone, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>;
}

function AperçuVocal({ colors, langue }: any) {
    type Teinte = "accent" | "success" | "pro";


  function couleursTeinte(teinte: Teinte) {
    if (teinte === "success") return { fond: colors.successBg, forte: colors.success, onForte: colors.background };
    if (teinte === "pro") return { fond: colors.proBg, forte: colors.proFill, onForte: colors.onPro };
    return { fond: colors.accentBg, forte: colors.accent, onForte: colors.background };
  }

  const teinteActive = couleursTeinte("pro");
  return (
    <View style={{ position: "relative", marginTop: 20 }}>
      <CarteTelephone colors={colors}>
        <View style={styles.ligneEnTeteApercu}>
          <View style={styles.ligneGauche}>
            <View style={[styles.pointRouge, { backgroundColor: colors.danger }]} />
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>{t("apercu_vocal_ecoute", langue)}</Text>
          </View>
          <Feather name="mic" size={16} color={colors.pro} />
        </View>
        <View style={[styles.blocApercu, { backgroundColor: colors.background }]}>
          <Text style={{ fontSize: 13, color: colors.textPrimary, fontStyle: "italic" }}>{t("apercu_vocal_transcription", langue)}</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "center", marginVertical: 8 }}>
          <Feather name="arrow-down" size={16} color={colors.textMuted} />
        </View>
        <View style={[styles.blocResultat, { backgroundColor: colors.successBg }]}>
          <Feather name="check-circle" size={14} color={colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: colors.textPrimary, fontWeight: "500" }}>{t("apercu_vocal_resultat_produit", langue)}</Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.success, fontWeight: "600" }}>{t("apercu_vocal_resultat_montant", langue)}</Text>
        </View>
      </CarteTelephone>
      <View style={[styles.badgeFlottant, { backgroundColor: colors.proFill }]}>
        <Feather name="zap" size={16} color={colors.onPro} />
      </View>
      <LinearGradient
        colors={[`${teinteActive.forte}00`, `${teinteActive.forte}22`]}
        style={styles.degrade}
        pointerEvents="none"
      />

    </View>
  );
}

function AperçuScan({ colors, langue }: any) {
    type Teinte = "accent" | "success" | "pro";


  function couleursTeinte(teinte: Teinte) {
    if (teinte === "success") return { fond: colors.successBg, forte: colors.success, onForte: colors.background };
    if (teinte === "pro") return { fond: colors.proBg, forte: colors.proFill, onForte: colors.onPro };
    return { fond: colors.accentBg, forte: colors.accent, onForte: colors.background };
  }

  const teinteActive = couleursTeinte("pro");
  return (
    <View style={{ position: "relative", marginTop: 20 }}>
      <CarteTelephone colors={colors}>
        <View style={styles.ligneEnTeteApercu}>
          <View style={styles.ligneGauche}>
            <Feather name="loader" size={13} color={colors.pro} />
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>{t("apercu_scan_analyse", langue)}</Text>
          </View>
          <Feather name="camera" size={16} color={colors.pro} />
        </View>
        <View style={[styles.blocApercu, { backgroundColor: colors.background, alignItems: "center" }]}>
          <Feather name="file-text" size={26} color={colors.textMuted} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "center", marginVertical: 8 }}>
          <Feather name="arrow-down" size={16} color={colors.textMuted} />
        </View>
        <View style={[styles.blocResultat, { backgroundColor: colors.successBg }]}>
          <Feather name="check-circle" size={14} color={colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: colors.textPrimary, fontWeight: "500" }}>{t("apercu_scan_resultat_produit", langue)}</Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.success, fontWeight: "600" }}>{t("apercu_scan_resultat_montant", langue)}</Text>
        </View>
      </CarteTelephone>
      <View style={[styles.badgeFlottant, { backgroundColor: colors.proFill }]}>
        <Feather name="zap" size={16} color={colors.onPro} />
      </View>
      <LinearGradient
        colors={[`${teinteActive.forte}00`, `${teinteActive.forte}22`]}
        style={styles.degrade}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fermer: { padding: 20, paddingTop: 50 },
  container: { paddingHorizontal: 28, paddingBottom: 20, alignItems: "center" },
  badgePro: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  carteTelephone: { width: "100%", borderRadius: 20, borderWidth: 1, padding: 16 },
  ligneEnTeteApercu: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  ligneGauche: { flexDirection: "row", alignItems: "center", gap: 6 },
  pointRouge: { width: 6, height: 6, borderRadius: 3 },
  blocApercu: { borderRadius: 12, padding: 14 },
  blocResultat: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, padding: 10 },
  badgeFlottant: { position: "absolute", top: -14, right: 10, width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  bas: { padding: 20, paddingBottom: 30, borderTopWidth: 1 },
  boutonPrincipal: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 10 },
  degrade: { position: "absolute", bottom: 0, left: 0, right: 0, height: 220, zIndex: 0 },

});