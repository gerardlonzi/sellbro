
import { View, ScrollView, Pressable, StyleSheet } from "react-native";
import { Text } from "@/components/Texte";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { PuceIcone, TonPuce } from "@/components/PuceIcone";
import { LinearGradient } from "expo-linear-gradient";
import { Apparition, PressableAnime } from "@/components/anim";
import { ouvrirOutilIA } from "@/lib/ia/ouvrirOutilIA";
import { IconeIA } from "@/components/IconeIA";
import { useAccesIA } from "@/lib/ia/useAccesIA";
import { ombre } from "@/components/UI";

type Entree = {
  icone: keyof typeof Feather.glyphMap;
  ton: TonPuce;
  cle: string;
  route: string;
};

type Section = {
  cle: string;
  entrees: Entree[];
};

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

// Regroupe les entrées par lignes de trois cartes.
function parTrois<T>(liste: T[]): T[][] {
  const groupes: T[][] = [];

  for (let i = 0; i < liste.length; i += 3) {
    groupes.push(liste.slice(i, i + 3));
  }

  return groupes;
}

export default function Plus() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { accesScan, accesVocal } = useAccesIA();

  // Les cartes IA conservent leur présentation horizontale.
  const OUTILS_IA = [
    {
      icone: "camera" as const,
      titre: "ia_scan_titre",
      desc: "ia_scan_desc",
      route: "/scan-facture",
      acces: accesScan,
      couleurs: ["#2FD0AE", "#0E7A66"] as [string, string],
    },
    {
      icone: "mic" as const,
      titre: "ia_vocal_titre",
      desc: "ia_vocal_desc",
      route: "/vente/vocal",
      acces: accesVocal,
      couleurs: ["#8B7CFF", "#4B3FBF"] as [string, string],
    },
  ];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: 14,
        paddingTop: 50,
      }}
    >
      <View style={{ marginBottom: 20, flexDirection:"row", alignItems:"center", gap:10 }}>
      <Pressable onPress={() => router.push("/reglages")} hitSlop={10}>
            <Feather name="menu" size={22} color={colors.textPrimary} />
          </Pressable>
        <Text
          style={{
            fontSize: 16,
            fontWeight: "700",
            color: colors.textPrimary,
          }}
        >
          {t("plus_titre", langue)}
        </Text>

        
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Outils IA */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={[
              styles.sectionTitre,
              { color: colors.textMuted },
            ]}
          >
            {t("ia_section_titre", langue)}
          </Text>

          <View style={{ gap: 10 }}>
            {OUTILS_IA.map((o, i) => (
              <Apparition key={o.route} delai={i * 90}>
                <PressableAnime
                  onPress={() =>
                    ouvrirOutilIA(o.route as any, o.acces, langue)
                  }
                  echelle={0.97}
                >
                  <LinearGradient
                    colors={o.couleurs}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.carteIA}
                  >
                    <View style={styles.rondIA}>
                      <IconeIA
                        type={o.icone === "camera" ? "scan" : "vocal"}
                        taille={22}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 15.5,
                          fontWeight: "800",
                        }}
                      >
                        {t(o.titre as any, langue)}
                      </Text>

                      <Text
                        style={{
                          color: "rgba(255,255,255,0.85)",
                          fontSize: 12,
                          marginTop: 3,
                          lineHeight: 17,
                        }}
                      >
                        {t(o.desc as any, langue)}
                      </Text>
                    </View>

                    {!o.acces ? (
                      <View style={styles.badgePro}>
                        <Feather
                          name="lock"
                          size={10}
                          color="#2A1D00"
                        />
                        <Text
                          style={{
                            color: "#2A1D00",
                            fontSize: 10,
                            fontWeight: "800",
                          }}
                        >
                          {t("ia_badge_pro", langue)}
                        </Text>
                      </View>
                    ) : (
                      <Feather
                        name="chevron-right"
                        size={20}
                        color="#fff"
                      />
                    )}
                  </LinearGradient>
                </PressableAnime>
              </Apparition>
            ))}
          </View>
        </View>

        {/* Sections métier : grille de trois colonnes */}
        {SECTIONS.map((section, si) => (
          <Apparition
            key={section.cle}
            delai={180 + si * 70}
            style={{ marginBottom: 18 }}
          >
            <Text
              style={[
                styles.sectionTitre,
                { color: colors.textMuted },
              ]}
            >
              {t(section.cle as any, langue)}
            </Text>

            {parTrois(section.entrees).map((groupe, i) => (
              <View key={i} style={styles.rangGrille}>
                {groupe.map((entree) => (
                  <PressableAnime
                    key={entree.route}
                    onPress={() => router.push(entree.route as any)}
                    echelle={0.96}
                    style={[
                      styles.carte,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                      ombre(colors, 1),
                    ]}
                  >
                    <PuceIcone
                      icone={entree.icone}
                      ton={entree.ton}
                      taille={36}
                    />

                    <Text
                      numberOfLines={2}
                      style={{
                        color: colors.textPrimary,
                        fontSize: 12,
                        fontWeight: "500",
                        marginTop: 8,
                        textAlign: "center",
                        flexShrink: 1,
                      }}
                    >
                      {t(entree.cle as any, langue)}
                    </Text>
                  </PressableAnime>
                ))}

                {/* Complète la dernière ligne pour conserver trois colonnes. */}
                {groupe.length < 3 &&
                  Array.from({
                    length: 3 - groupe.length,
                  }).map((_, index) => (
                    <View
                      key={`vide-${index}`}
                      style={styles.carteVide}
                    />
                  ))}
              </View>
            ))}
          </Apparition>
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

  rangGrille: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },

  carte: {
    flex: 1,
    minWidth: 0,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
    minHeight: 90,
  },

  carteVide: {
    flex: 1,
  },

  carteIA: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 20,
    padding: 16,
  },

  rondIA: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },

  badgePro: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F5B942",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
  },
});
