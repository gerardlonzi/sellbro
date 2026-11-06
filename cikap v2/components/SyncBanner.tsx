import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { sAbonnerSync, EtatSync } from "@/lib/sync/syncStatus";

// Indicateur global de synchronisation : petite icône cloud flottante au-dessus
// de la barre d'onglets. Spinner pendant la sync, coche verte ~2,5 s à la fin,
// puis disparaît. Remplace l'ancienne barre textuelle.
export function SyncBanner() {
  const { colors } = useTheme();
  const [etat, setEtat] = useState<EtatSync>("idle");
  const [visible, setVisible] = useState(false);

  useEffect(() => sAbonnerSync(setEtat), []);

  useEffect(() => {
    if (etat === "syncing") {
      setVisible(true);
      return;
    }
    if (etat === "complete") {
      setVisible(true);
      const minuteur = setTimeout(() => setVisible(false), 2500);
      return () => clearTimeout(minuteur);
    }
    setVisible(false);
  }, [etat]);

  if (!visible) return null;

  const syncing = etat === "syncing";

  return (
    <View pointerEvents="none" style={styles.conteneur}>
      <View style={[styles.pastille, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Feather name="cloud" size={16} color={syncing ? colors.accent : colors.success} />
        <View style={[styles.badge, { backgroundColor: colors.surface }]}>
          {syncing ? (
            <ActivityIndicator size={10} color={colors.accent} />
          ) : (
            <Feather name="check" size={9} color={colors.success} />
          )}
        </View>
      </View>
    </View>
  );
}

// Version compacte pour les en-têtes d'écran (ex. à gauche de la cloche de
// notifications) : cloud gris au repos, spinner pendant la sync, coche verte
// quelques secondes après une sync réussie, rouge en cas d'échec.
export function IndicateurSync() {
  const { colors } = useTheme();
  const [etat, setEtat] = useState<EtatSync>("idle");
  const [montreCoche, setMontreCoche] = useState(false);

  useEffect(() => sAbonnerSync(setEtat), []);

  useEffect(() => {
    if (etat !== "complete") {
      setMontreCoche(false);
      return;
    }
    setMontreCoche(true);
    const minuteur = setTimeout(() => setMontreCoche(false), 2500);
    return () => clearTimeout(minuteur);
  }, [etat]);

  if (etat === "syncing") {
    return <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 10 }} />;
  }
  if (etat === "error") {
    return <Feather name="cloud-off" size={18} color={colors.danger} style={{ marginRight: 10 }} />;
  }
  return (
    <View style={{ marginRight: 10 }}>
      <Feather name="cloud" size={18} color={montreCoche ? colors.success : colors.textMuted} />
      {montreCoche && (
        <View style={[styles.miniCoche, { backgroundColor: colors.success }]}>
          <Feather name="check" size={7} color="#fff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  miniCoche: {
    position: "absolute",
    top: -3,
    right: -4,
    width: 11,
    height: 11,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  // Centré en bas, au-dessus de la barre d'onglets.
  conteneur: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 76,
    alignItems: "center",
  },
  pastille: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
