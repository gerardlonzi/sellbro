import { useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase/client";
import { chargerNotifications, marquerLueLocale, NotificationItem } from "@/lib/notifications/notifications";

type Notification = NotificationItem;

const ICONES: Record<string, keyof typeof Feather.glyphMap> = {
  creance_retard: "alert-triangle",
  stock_faible: "package",
  rupture_stock: "package",
  sync_ok: "check-circle",
  sync_echec: "x-circle",
  echeance_proche: "clock",
};

export default function Notifications() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const [liste, setListe] = useState<Notification[]>([]);
  const [chargement, setChargement] = useState(true);

  // Charge via le helper : en ligne depuis Supabase (mis en cache), hors ligne
  // depuis le cache + les alertes détectées localement.
  useFocusEffect(
    useCallback(() => {
      setChargement(true);
      chargerNotifications()
        .then(setListe)
        .finally(() => setChargement(false));
    }, [])
  );

  // Compose le libellé localisé : les alertes stockent seulement le nom de
  // l'item, le préfixe est ajouté ici selon la langue de l'utilisateur.
  function libelle(n: Notification): string {
    if (n.type === "rupture_stock") return `${t("notif_rupture_stock", langue)} : ${n.message}`;
    if (n.type === "stock_faible") return `${t("notif_stock_faible", langue)} : ${n.message}`;
    if (n.type === "creance_retard") return `${t("notif_creance_retard", langue)} : ${n.message}`;
    return n.message;
  }

  // Couleur d'icône différente selon le type d'alerte.
  function couleurIcone(n: Notification): string {
    if (n.lu) return colors.textMuted;
    if (n.type === "rupture_stock" || n.type === "creance_retard") return colors.danger;
    if (n.type === "stock_faible") return colors.warning;
    return colors.textSecondary;
  }

  async function marquerLue(id: string) {
    // Local d'abord (fonctionne hors ligne), puis le serveur si possible.
    await marquerLueLocale(id);
    setListe((prev) => prev.map((n) => (n.id === id ? { ...n, lu: true } : n)));
    if (!id.startsWith("local|")) {
      try {
        await supabase.from("notifications").update({ lu: true }).eq("id", id);
      } catch {
        // Hors ligne : l'état local suffit jusqu'à la prochaine connexion.
      }
    }
  }

  const vide = liste.length === 0;

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

      {chargement ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : vide ? (
        <View style={styles.vide}>
          <Feather name="bell-off" size={28} color={colors.textMuted} style={{ marginBottom: 10 }} />
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t("notifications_vide", langue)}</Text>
        </View>
      ) : (
        liste.map((n) => (
          <Pressable
            key={n.id}
            onPress={() => {
              if (!n.lu) marquerLue(n.id);
              if (n.lien) router.push(n.lien as any);
            }}
            style={[styles.ligne, { borderBottomColor: colors.border, backgroundColor: n.lu ? colors.background : colors.surface }]}
          >
            <Feather name={ICONES[n.type] ?? "bell"} size={17} color={couleurIcone(n)} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: n.lu ? colors.textSecondary : colors.textPrimary, fontSize: 13 }}>{libelle(n)}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                {new Date(n.created_at).toLocaleString(langue === "fr" ? "fr-FR" : "en-US")}
              </Text>
            </View>
            <View style={[styles.badgeLu, { backgroundColor: n.lu ? colors.border : colors.accentBg }]}>
              <Text style={{ color: n.lu ? colors.textSecondary : colors.accent, fontSize: 10 }}>
                {n.lu ? t("notif_lu", langue) : t("notif_non_lu", langue)}
              </Text>
            </View>
            {n.lien ? <Feather name="chevron-right" size={16} color={colors.textMuted} /> : null}
          </Pressable>
        ))
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
  badgeLu: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
});