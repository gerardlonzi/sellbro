import { useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase/client";
import { detecterAlertes } from "@/lib/notifications/notifications";
import { parserDateSeule } from "@/lib/formatDate";

type Notification = { id: string; type: string; message: string; lu: boolean; created_at: string; lien?: string | null };
type AlerteLocale = { id: string; type: string; message: string; route: string; creeLe: Date };

const ICONES: Record<string, keyof typeof Feather.glyphMap> = {
  creance_retard: "alert-triangle",
  stock_faible: "package",
  sync_ok: "check-circle",
  sync_echec: "x-circle",
  echeance_proche: "clock",
};

export default function Notifications() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const [liste, setListe] = useState<Notification[]>([]);
  const [alertesLocales, setAlertesLocales] = useState<AlerteLocale[]>([]);
  const [chargement, setChargement] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setChargement(true);

      Promise.all([
        supabase
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .then(({ data }) => setListe(data ?? [])),
        // Alertes locales détaillées (produit/créance précis), même hors ligne.
        detecterAlertes().then(({ produitsFaibles, creancesRetard }) => {
          const locales: AlerteLocale[] = [];
          for (const p of produitsFaibles) {
            locales.push({
              id: `stock-${p.id}`,
              type: "stock_faible",
              message: `${t("notif_stock_faible", langue)} : ${p.nom}`,
              route: `/produit/${p.id}`,
              creeLe: new Date(),
            });
          }
          for (const c of creancesRetard) {
            locales.push({
              id: `creance-${c.id}`,
              type: "creance_retard",
              message: `${t("notif_creance_retard", langue)} : ${c.nom}`,
              route: `/creances/${c.id}`,
              creeLe: c.dateEcheance ? parserDateSeule(c.dateEcheance) : new Date(),
            });
          }
          setAlertesLocales(locales);
        }),
      ]).finally(() => setChargement(false));
    }, [langue])
  );

  async function marquerLue(id: string) {
    await supabase.from("notifications").update({ lu: true }).eq("id", id);
    setListe((prev) => prev.map((n) => (n.id === id ? { ...n, lu: true } : n)));
  }

  // Fusionne alertes locales + notifications distantes, triées par date
  // (plus récentes en haut).
  type EntreeNotif = { id: string; type: string; message: string; date: Date; route?: string; lu: boolean; local: boolean };
  const combinees: EntreeNotif[] = [
    ...alertesLocales.map((a) => ({ id: a.id, type: a.type, message: a.message, date: a.creeLe, route: a.route, lu: false, local: true })),
    ...liste.map((n) => ({ id: n.id, type: n.type, message: n.message, date: new Date(n.created_at), route: n.lien ?? undefined, lu: n.lu, local: false })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const vide = combinees.length === 0;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View style={styles.entete}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.boutonRetour}>
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: "500", color: colors.textPrimary }}>
          {t("notifications_page_titre", langue)}
        </Text>
      </View>

      {vide ? (
        <View style={styles.vide}>
          <Feather name="bell-off" size={28} color={colors.textMuted} style={{ marginBottom: 10 }} />
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t("notifications_vide", langue)}</Text>
        </View>
      ) : (
        <>
          {combinees.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => {
                if (!n.local && !n.lu) marquerLue(n.id);
                if (n.route) router.push(n.route as any);
              }}
              style={[styles.ligne, { borderBottomColor: colors.border, backgroundColor: n.local || !n.lu ? colors.surface : colors.background }]}
            >
              <Feather name={ICONES[n.type] ?? "bell"} size={17} color={n.local ? colors.danger : n.lu ? colors.textMuted : colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: !n.local && n.lu ? colors.textSecondary : colors.textPrimary, fontSize: 13 }}>{n.message}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                  {n.date.toLocaleString(langue === "fr" ? "fr-FR" : "en-US")}
                </Text>
              </View>
              {!n.local ? (
                <View style={[styles.badgeLu, { backgroundColor: n.lu ? colors.border : colors.accentBg }]}>
                  <Text style={{ color: n.lu ? colors.textSecondary : colors.accent, fontSize: 10 }}>
                    {n.lu ? t("notif_lu", langue) : t("notif_non_lu", langue)}
                  </Text>
                </View>
              ) : null}
              {n.route ? <Feather name="chevron-right" size={16} color={colors.textMuted} /> : null}
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, paddingTop: 50 },
  entete: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  boutonRetour: { paddingVertical: 2 },
  vide: { alignItems: "center", paddingTop: 40 },
  ligne: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, paddingHorizontal: 10 },
  point: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  badgeLu: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
});