import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase/client";

type Notification = { id: string; type: string; message: string; lu: boolean; created_at: string };
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

  useEffect(() => {
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).then(({ data }) => setListe(data ?? []));
  }, []);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={{ fontSize: 16, fontWeight: "500", color: colors.textPrimary, marginBottom: 16 }}>
        {t("notifications_page_titre", langue)}
      </Text>
      {liste.length === 0 ? (
        <View style={styles.vide}>
          <Feather name="bell-off" size={28} color={colors.textMuted} style={{ marginBottom: 10 }} />
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t("notifications_vide", langue)}</Text>
        </View>
      ) : (
        liste.map((n) => (
          <View key={n.id} style={[styles.ligne, { borderBottomColor: colors.border }]}>
            <Feather name={ICONES[n.type] ?? "bell"} size={17} color={colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: n.lu ? colors.textSecondary : colors.textPrimary, fontSize: 13 }}>{n.message}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                {new Date(n.created_at).toLocaleString(langue === "fr" ? "fr-FR" : "en-US")}
              </Text>
            </View>
            {!n.lu && <View style={[styles.point, { backgroundColor: colors.accent }]} />}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, paddingTop: 50 },
  vide: { alignItems: "center", paddingTop: 40 },
  ligne: { flexDirection: "row", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  point: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
});