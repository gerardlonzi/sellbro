import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, ActivityIndicator, Switch } from "react-native";
import { Text } from "@/components/Texte";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { usePlanActuel } from "@/lib/plan/usePlanActuel";
import { useEssai } from "@/lib/trial/useEssai";
import { useAbonnement } from "@/lib/plan/useAbonnement";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { Carte, EnteteEcran } from "@/components/UI";
import { Apparition, PressableAnime } from "@/components/anim";
import { CarteAbonnement } from "@/components/CarteAbonnement";
import { PuceIcone, TonPuce } from "@/components/PuceIcone";
import { sAbonnerSync, EtatSync } from "@/lib/sync/syncStatus";
import { synchroniserPourUtilisateurCourant } from "@/lib/database/sync";
import { useConnexion } from "@/lib/useConnexion";

export default function Reglages() {
  const { colors, mode, setMode, isDark } = useTheme();
  const { langue } = useLangue();
  const { plan } = usePlanActuel();
  const essai = useEssai();
  const { expire: abonnementExpire, joursRestants: joursAbonnement } = useAbonnement();
  const { formater } = useCurrency();
  const enLigne = useConnexion();
  const [etatSync, setEtatSync] = useState<EtatSync>("idle");

  useEffect(() => sAbonnerSync(setEtatSync), []);

  // Recharge l'état de l'essai à chaque focus (jours restants à jour).
  useFocusEffect(
    useCallback(() => {
      essai.recharger();
    }, [essai.recharger])
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <EnteteEcran titre={t("reglages_titre", langue)} onRetour={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>

        <Apparition>
          <CarteAbonnement />
        </Apparition>

        {/* État de synchronisation + déclenchement manuel */}
        <Apparition delai={70}>
        <Carte style={{ marginBottom: 12 }}>
          <View style={styles.ligneReglage}>
            <View style={styles.ligneReglageGauche}>
              <PuceIcone icone="cloud" ton={!enLigne ? "ambre" : etatSync === "error" ? "rose" : "vert"} taille={30} />
              <View>
                <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{t("reglages_sync_titre", langue)}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>
                  {!enLigne
                    ? t("hors_ligne", langue)
                    : etatSync === "syncing"
                      ? t("sync_en_cours", langue)
                      : etatSync === "complete"
                        ? t("sync_terminee", langue)
                        : etatSync === "error"
                          ? t("sync_erreur", langue)
                          : t("sync_jamais", langue)}
                </Text>
              </View>
            </View>
            {etatSync === "syncing" ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Pressable
                onPress={() => synchroniserPourUtilisateurCourant().catch(() => { })}
                disabled={!enLigne}
                style={[styles.boutonPro, { backgroundColor: colors.proBg, opacity: enLigne ? 1 : 0.5 }]}
              >
                <Text style={{ color: colors.pro, fontSize: 11 }}>{t("reglages_sync_bouton", langue)}</Text>
              </Pressable>
            )}
          </View>
        </Carte>
        </Apparition>

        <Apparition delai={130}>
        <SectionTitre titre={t("reglages_apparence", langue)} />
        <Carte style={{ marginBottom: 16 }}>
          <View style={styles.ligneReglage}>
            <View style={styles.ligneReglageGauche}>
              <PuceIcone icone={isDark ? "moon" : "sun"} ton="lilas" taille={30} />
              <View>
                <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{t("reglages_theme_sombre", langue)}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>
                  {/* « auto » n'est pas une troisième position du switch : c'est
                      l'état initial, tant que l'utilisateur n'a rien choisi.
                      On l'affiche donc comme une information, pas comme un mode. */}
                  {mode === "auto"
                    ? `${t("reglages_theme_auto", langue)} · ${t(isDark ? "reglages_theme_sombre" : "reglages_theme_clair", langue)}`
                    : t(`reglages_theme_${mode}` as any, langue)}
                </Text>
              </View>
            </View>
            <Switch
              value={isDark}
              onValueChange={(actif) => setMode(actif ? "sombre" : "clair")}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surface}
            />
          </View>
        </Carte>
        </Apparition>

        <Apparition delai={190}>
        <SectionTitre titre={t("reglages_section_boutique", langue)} />
        <Carte style={{ marginBottom: 16 }}>
          <LigneReglage icone="home" ton="violet" label={t("reglages_info_boutique", langue)} onPress={() => router.push("/reglages/boutique")} />
          <LigneReglage icone="tag" ton="lilas" label={t("reglages_categories", langue)} onPress={() => router.push("/reglages/categories")} />
          <LigneReglage icone="users" ton="bleu" label={t("employes_titre", langue)} onPress={() => router.push("/reglages/employes")} dernier />
        </Carte>
        </Apparition>

        <Apparition delai={250}>
        <SectionTitre titre={t("reglages_section_general", langue)} />
        <Carte style={{ marginBottom: 16 }}>
          <LigneReglage icone="globe" ton="vert" label={t("reglages_langue_devise", langue)} onPress={() => router.push("/reglages/langue-devise")} />
          <LigneReglage icone="bell" ton="ambre" label={t("reglages_notifications", langue)} onPress={() => router.push("/reglages/notifications")} />
          <LigneReglage icone="truck" ton="rose" label={t("fournisseurs_titre", langue)} onPress={() => router.push("/fournisseurs")} />
          <LigneReglage icone="credit-card" ton="bleu" label={t("depenses_titre", langue)} onPress={() => router.push("/depenses")} />
          <LigneReglage icone="file-text" ton="violet" label={t("reglages_export_comptable", langue)} onPress={() => router.push("/export")} />
          <LigneReglage icone="file-text" ton="lilas" label={t("factures_titre", langue)} onPress={() => router.push("/factures")} />
          <LigneReglage icone="activity" ton="ambre" label={t("reglages_journal", langue)} onPress={() => router.push("/journal")} />
          <LigneReglage icone="headphones" ton="vert" label={t("reglages_contact", langue)} onPress={() => router.push("/contact")} />
          <LigneReglage icone="activity" ton="bleu" label={t("reglages_diagnostic", langue)} onPress={() => router.push("/reglages/diagnostic")} dernier />
        </Carte>
        </Apparition>

        <Apparition delai={310}>
        <SectionTitre titre={t("reglages_section_compte", langue)} />
        <Carte style={{ marginBottom: 16 }}>
          <LigneReglage icone="user" ton="bleu" label={t("compte_titre", langue)} onPress={() => router.push("/reglages/compte")} dernier />
        </Carte>
        </Apparition>

      </ScrollView>
    </View>
  );
}

function SectionTitre({ titre }: { titre: string }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 8, marginLeft: 4, textTransform: "uppercase" }}>{titre}</Text>;
}

// `ton` est explicite plutôt que déduit du nom d'icône : deux lignes voisines
// peuvent partager la même icône (file-text sert à l'export et aux factures) et
// doivent pourtant se distinguer d'un coup d'œil.
function LigneReglage({ icone, ton, label, dernier, onPress }: { icone: any; ton: TonPuce; label: string; dernier?: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableAnime onPress={onPress} echelle={0.985} style={undefined}>
      <View style={[styles.ligneReglage, !dernier && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
        <View style={styles.ligneReglageGauche}>
          <PuceIcone icone={icone} ton={ton} taille={34} />
          <Text style={{ color: colors.textPrimary, fontSize: 14.5, fontWeight: "500" }}>{label}</Text>
        </View>
        <Feather name="chevron-right" size={17} color={colors.textMuted} />
      </View>
    </PressableAnime>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, paddingTop: 50 },
  ligneAbonnement: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  boutonPro: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  ligneReglage: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  ligneReglageGauche: { flexDirection: "row", alignItems: "center", gap: 10 },
});