import { useEffect, useState } from "react";
import { View, Text, Switch, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { EnteteEcran, Carte } from "@/components/UI";
import { verifierAlertesEtNotifier, lireHeuresRappel, CLE_HEURES_NOTIF } from "@/lib/notifications/notifications";

const LIGNES = [
  { cle: "notif_creance_retard_active", labelCle: "notif_creance_retard" },
  { cle: "notif_stock_faible_active", labelCle: "notif_stock_faible" },
  { cle: "notif_echeance_proche_active", labelCle: "notif_echeance_proche" },
];

// Heures de rappel proposées (7h → 21h).
const HEURES_PROPOSEES = [7, 9, 12, 13, 15, 18, 20, 21];

export default function ReglagesNotifications() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const [etats, setEtats] = useState<Record<string, boolean>>({});
  const [heures, setHeures] = useState<number[]>([9, 13, 18]);

  useEffect(() => {
    (async () => {
      const valeurs: Record<string, boolean> = {};
      for (const l of LIGNES) {
        const v = await AsyncStorage.getItem(l.cle);
        valeurs[l.cle] = v !== "false";
      }
      setEtats(valeurs);
      setHeures(await lireHeuresRappel());
    })();
  }, []);

  function replanifier() {
    // Re-planifie immédiatement les notifications selon les nouveaux réglages.
    verifierAlertesEtNotifier().catch(() => {});
  }

  async function basculer(cle: string) {
    const nouvelleValeur = !etats[cle];
    setEtats((prev) => ({ ...prev, [cle]: nouvelleValeur }));
    await AsyncStorage.setItem(cle, String(nouvelleValeur));
    replanifier();
  }

  async function basculerHeure(heure: number) {
    const actives = heures.includes(heure)
      ? heures.filter((h) => h !== heure)
      : [...heures, heure].sort((a, b) => a - b);
    // Au moins une heure doit rester active, sinon plus aucun rappel.
    if (actives.length === 0) return;
    setHeures(actives);
    await AsyncStorage.setItem(CLE_HEURES_NOTIF, JSON.stringify(actives));
    replanifier();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <EnteteEcran titre={t("notifications_reglage_titre", langue)} onRetour={() => router.back()} />
      <Carte>
        {LIGNES.map((l, i) => (
          <View key={l.cle} style={[styles.ligne, i < LIGNES.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <Text style={{ color: colors.textPrimary, fontSize: 13, flex: 1 }}>{t(l.labelCle as any, langue)}</Text>
            <Switch value={etats[l.cle] ?? true} onValueChange={() => basculer(l.cle)} trackColor={{ false: colors.border, true: colors.accent }} />
          </View>
        ))}
      </Carte>

      {/* Choix des heures de rappel : chaque heure active = 1 notification/jour. */}
      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500", marginTop: 18, marginBottom: 8 }}>
        {t("notif_heures_titre", langue)}
      </Text>
      <View style={styles.grilleHeures}>
        {HEURES_PROPOSEES.map((heure) => {
          const active = heures.includes(heure);
          return (
            <Pressable
              key={heure}
              onPress={() => basculerHeure(heure)}
              style={[
                styles.puceHeure,
                { borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accent : "transparent" },
              ]}
            >
              <Text style={{ color: active ? "#fff" : colors.textPrimary, fontSize: 13, fontWeight: active ? "600" : "400" }}>
                {heure}h
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8 }}>
        {t("notif_heures_aide", langue)(heures.length)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  grilleHeures: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  puceHeure: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
});
