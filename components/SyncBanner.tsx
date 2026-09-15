import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { sAbonnerSync, EtatSync } from "@/lib/sync/syncStatus";

// Indicateur global de synchronisation : affiché pendant « Synchronisation… »
// puis « Synchronisation terminée », notamment au login sur un nouvel appareil.
export function SyncBanner() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const [etat, setEtat] = useState<EtatSync>("idle");

  useEffect(() => sAbonnerSync(setEtat), []);

  if (etat === "idle" || etat === "error") return null;

  const syncing = etat === "syncing";

  return (
    <View style={[styles.bandeau, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {syncing ? <ActivityIndicator size="small" color={colors.accent} /> : null}
      <Text style={{ color: colors.textPrimary, fontSize: 12 }}>
        {syncing ? t("sync_en_cours", langue) : t("sync_terminee", langue)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bandeau: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    margin: 12,
  },
});