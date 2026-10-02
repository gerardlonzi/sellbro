import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Switch } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { usePlanActuel } from "@/lib/plan/usePlanActuel";
import { useEssai } from "@/lib/trial/useEssai";
import { useAbonnement } from "@/lib/plan/useAbonnement";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { Carte, EnteteEcran } from "@/components/UI";
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

        <Carte style={{ marginBottom: 12 }}>
          <View style={styles.ligneAbonnement}>
            <View>
              {!essai.pret || !essai.verifie ? (
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>…</Text>
              ) : essai.estPremium ? (
                <>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, justifyContent:"space-between" }}>
                    <View>
                      <View style={{flexDirection:"row",alignItems:"center", gap:6}}>
                        <Feather name="check-circle" size={16} color={colors.pro} />
                        <Text style={{ color: colors.pro, fontSize: 13, fontWeight: "600" }}>{t("premium_mode", langue)}</Text>

                      </View>
                      <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                        {t("premium_expire_dans", langue)(joursAbonnement)}
                      </Text>

                    </View>
                    <View style={{ backgroundColor: colors.proBg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 , marginLeft:25}}>
                      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{t("premium_puce_active", langue)}</Text>
                    </View>
                    {/* Puce de statut : l'abonnement est actif. */}

                  </View>
                </>
              ) : essai.actif ? (
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>
                  {t("essai_actif_reste", langue)(essai.joursRestants)}
                </Text>
              ) : (
                <Text style={{ color: colors.danger, fontSize: 13, fontWeight: "500" }}>
                  {abonnementExpire ? t("abonnement_termine_statut", langue) : t("essai_termine_statut", langue)}
                </Text>
              )}
              {essai.pret && essai.verifie && plan && !essai.estPremium && essai.prix != null && (
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                  {t("version_pro", langue)} · {formater(essai.prix)} / {t("mois_title", langue)}
                </Text>
              )}
            </View>
            {essai.pret && essai.verifie && !essai.estPremium && (
              <Pressable onPress={() => router.push("/premium")} style={[styles.boutonPro, { backgroundColor: essai.actif ? colors.proFill : colors.danger }]}>
                <Text style={{ color: essai.actif ? colors.onPro : "#fff", fontSize: 11 }}>
                  {essai.actif ? t("version_pro", langue) : abonnementExpire ? t("abonnement_termine_renew", langue) : t("reglages_upgrade", langue)}
                </Text>
              </Pressable>
            )}
          </View>
        </Carte>

        {/* État de synchronisation + déclenchement manuel */}
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

        <SectionTitre titre={t("reglages_section_boutique", langue)} />
        <Carte style={{ marginBottom: 16 }}>
          <LigneReglage icone="home" ton="violet" label={t("reglages_info_boutique", langue)} onPress={() => router.push("/reglages/boutique")} />
          <LigneReglage icone="tag" ton="lilas" label={t("reglages_categories", langue)} onPress={() => router.push("/reglages/categories")} />
          <LigneReglage icone="users" ton="bleu" label={t("employes_titre", langue)} onPress={() => router.push("/reglages/employes")} dernier />
        </Carte>

        <SectionTitre titre={t("reglages_section_general", langue)} />
        <Carte style={{ marginBottom: 16 }}>
          <LigneReglage icone="globe" ton="vert" label={t("reglages_langue_devise", langue)} onPress={() => router.push("/reglages/langue-devise")} />
          <LigneReglage icone="bell" ton="ambre" label={t("reglages_notifications", langue)} onPress={() => router.push("/reglages/notifications")} />
          <LigneReglage icone="truck" ton="rose" label={t("fournisseurs_titre", langue)} onPress={() => router.push("/fournisseurs")} />
          <LigneReglage icone="credit-card" ton="bleu" label={t("depenses_titre", langue)} onPress={() => router.push("/depenses")} />
          <LigneReglage icone="file-text" ton="violet" label={t("reglages_export_comptable", langue)} onPress={() => router.push("/export")} />
          <LigneReglage icone="file-text" ton="lilas" label={t("factures_titre", langue)} onPress={() => router.push("/factures")} />
          <LigneReglage icone="activity" ton="ambre" label={t("reglages_journal", langue)} onPress={() => router.push("/journal")} />
          <LigneReglage icone="headphones" ton="vert" label={t("reglages_contact", langue)} onPress={() => router.push("/contact")} dernier />
        </Carte>

        <SectionTitre titre={t("reglages_section_compte", langue)} />
        <Carte style={{ marginBottom: 16 }}>
          <LigneReglage icone="user" ton="bleu" label={t("compte_titre", langue)} onPress={() => router.push("/reglages/compte")} dernier />
        </Carte>


      </ScrollView>
    </View>
  );
}

function SectionTitre({ titre }: { titre: string }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 8, textTransform: "uppercase" }}>{titre}</Text>;
}

// `ton` est explicite plutôt que déduit du nom d'icône : deux lignes voisines
// peuvent partager la même icône (file-text sert à l'export et aux factures) et
// doivent pourtant se distinguer d'un coup d'œil.
function LigneReglage({ icone, ton, label, dernier, onPress }: { icone: any; ton: TonPuce; label: string; dernier?: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.ligneReglage, !dernier && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <View style={styles.ligneReglageGauche}>
        <PuceIcone icone={icone} ton={ton} taille={30} />
        <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{label}</Text>
      </View>
      <Feather name="chevron-right" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, paddingTop: 50 },
  ligneAbonnement: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  boutonPro: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  ligneReglage: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  ligneReglageGauche: { flexDirection: "row", alignItems: "center", gap: 10 },
});