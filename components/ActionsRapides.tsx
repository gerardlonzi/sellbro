import { ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "@/components/Texte";
import { Apparition, PressableAnime } from "@/components/anim";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { ouvrirOutilIA } from "@/lib/ia/ouvrirOutilIA";
import { IconeIA } from "@/components/IconeIA";
import { useAccesIA } from "@/lib/ia/useAccesIA";
import { peutEcrire } from "@/lib/trial/gate";
import { afficherPaywall } from "@/lib/trial/paywall";

// Rangée d'actions rapides en tête de l'accueil : vente, scan de facture,
// vente vocale, nouveau produit. Les deux outils IA portent un cadenas quand
// le compte n'y a pas accès (l'écran cible ouvre alors le paywall).
export function ActionsRapides() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { accesScan, accesVocal } = useAccesIA();

  const actions = [
    { icone: "shopping-cart" as const, cle: "action_nouvelle_vente", couleurs: [colors.accentClair, colors.accent] as [string, string], verrou: false, aller: () => router.push("/vente/nouvelle") },
    { icone: "camera" as const, ia: "scan" as const, cle: "action_scanner", couleurs: ["#8B7CFF", "#5B4BE0"] as [string, string], verrou: !accesScan, aller: () => ouvrirOutilIA("/scan-facture", accesScan, langue) },
    { icone: "mic" as const, ia: "vocal" as const, cle: "action_vocal", couleurs: ["#FF9A62", "#F0663D"] as [string, string], verrou: !accesVocal, aller: () => ouvrirOutilIA("/vente/vocal", accesVocal, langue) },
    {
      icone: "package" as const,
      cle: "action_produit",
      couleurs: ["#4FA3F7", "#2563EB"] as [string, string],
      verrou: false,
      aller: async () => {
        if (!(await peutEcrire())) return afficherPaywall(langue, () => router.push("/premium"));
        router.push("/produit/nouveau");
      },
    },
  ];

  return (
    <Apparition style={{ marginBottom: 14 }}>
      <Text style={[styles.titre, { color: colors.textMuted }]}>{t("actions_rapides", langue)}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ligne}>
        {actions.map((a) => (
          <PressableAnime key={a.cle} onPress={a.aller} echelle={0.93} style={styles.tuile}>
            <LinearGradient colors={a.couleurs} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pastille}>
              {"ia" in a && a.ia ? <IconeIA type={a.ia} taille={22} /> : <Feather name={a.icone} size={22} color="#fff" />}
              {a.verrou && (
                <View style={[styles.cadenas, { backgroundColor: "#F5B942", borderColor: colors.background }]}>
                  <Feather name="lock" size={9} color="#2A1D00" />
                </View>
              )}
            </LinearGradient>
            <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "600", marginTop: 7 }}>{t(a.cle as any, langue)}</Text>
          </PressableAnime>
        ))}
      </ScrollView>
    </Apparition>
  );
}

const styles = StyleSheet.create({
  titre: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 10, marginLeft: 4 },
  ligne: { gap: 14, paddingHorizontal: 4 },
  tuile: { alignItems: "center", width: 74 },
  pastille: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", elevation: 3, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  cadenas: { position: "absolute", top: -4, right: -4, width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
