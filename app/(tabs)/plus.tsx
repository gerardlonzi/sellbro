import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { PuceIcone, TonPuce } from "@/components/PuceIcone";

// Chaque entrée : icône, ton de la pastille, clé i18n du libellé, route.
// Les sections reprennent le découpage métier demandé ; « Autres » accueille
// ce qui n'entrait dans aucune des trois (mouvements, réglages).
type Entree = { icone: keyof typeof Feather.glyphMap; ton: TonPuce; cle: string; route: string };
type Section = { cle: string; entrees: Entree[] };

const SECTIONS: Section[] = [
  {
    cle: "plus_section_ventes_clients",
    entrees: [
      { icone: "users", ton: "violet", cle: "plus_clients", route: "/clients" },
      { icone: "file-text", ton: "lilas", cle: "factures_titre", route: "/factures" },
      { icone: "repeat", ton: "bleu", cle: "plus_creances", route: "/creances" },
    ],
  },
  {
    cle: "plus_section_achats_depenses",
    entrees: [
      { icone: "truck", ton: "rose", cle: "fournisseurs_titre", route: "/fournisseurs" },
      { icone: "credit-card", ton: "ambre", cle: "depenses_titre", route: "/depenses" },
      { icone: "shopping-cart", ton: "vert", cle: "plus_achats", route: "/achats" },
    ],
  },
  {
    cle: "plus_section_comptabilite",
    entrees: [
      { icone: "download", ton: "violet", cle: "plus_export", route: "/export" },
      { icone: "activity", ton: "lilas", cle: "plus_journal", route: "/journal" },
    ],
  },
  {
    cle: "plus_section_autres",
    entrees: [
      { icone: "refresh-cw", ton: "bleu", cle: "plus_mouvements", route: "/mouvements" },
      { icone: "settings", ton: "vert", cle: "plus_reglages", route: "/reglages" },
    ],
  },
];

// Grille 2 colonnes par paires : plus fiable que flexWrap dans un ScrollView
// sur l'architecture legacy (newArchEnabled: false), où le contenu pouvait
// s'afficher vide.
function parPaires<T>(liste: T[]): T[][] {
  const paires: T[][] = [];
  for (let i = 0; i < liste.length; i += 2) paires.push(liste.slice(i, i + 2));
  return paires;
}

export default function Plus() {
  const { colors } = useTheme();
  const { langue } = useLangue();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.textPrimary }}>{t("plus_titre", langue)}</Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{t("plus_sous_titre", langue)}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {SECTIONS.map((section) => (
          <View key={section.cle} style={{ marginBottom: 18 }}>
            <Text style={[styles.sectionTitre, { color: colors.textMuted }]}>{t(section.cle as any, langue)}</Text>
            {parPaires(section.entrees).map((paire, i) => (
              <View key={i} style={styles.rangGrille}>
                {paire.map((entree) => (
                  <Pressable
                    key={entree.route}
                    onPress={() => router.push(entree.route as any)}
                    style={({ pressed }) => [
                      styles.carte,
                      { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <PuceIcone icone={entree.icone} ton={entree.ton} taille={36} />
                    {/* Le titre est À DROITE de l'icône, pas en dessous :
                        plus compact et plus lisible en grille. */}
                    <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500", marginLeft: 10, flexShrink: 1 }}>
                      {t(entree.cle as any, langue)}
                    </Text>
                  </Pressable>
                ))}
                {/* Ligne incomplète : une cellule vide garde l'alignement des 2 colonnes. */}
                {paire.length === 1 && <View style={styles.carteVide} />}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitre: {
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 2,
    letterSpacing: 0.4,
  },
  rangGrille: { flexDirection: "row", gap: 10, marginBottom: 10 },
  carte: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  carteVide: { flex: 1 },
});
