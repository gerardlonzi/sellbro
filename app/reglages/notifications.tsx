import { useEffect, useState } from "react";
import { View, Text, Switch, StyleSheet } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { EnteteEcran, Carte } from "@/components/UI";

const LIGNES = [
  { cle: "notif_creance_retard_active", labelCle: "notif_creance_retard" },
  { cle: "notif_stock_faible_active", labelCle: "notif_stock_faible" },
  { cle: "notif_echeance_proche_active", labelCle: "notif_echeance_proche" },
];

export default function ReglagesNotifications() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const [etats, setEtats] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const valeurs: Record<string, boolean> = {};
      for (const l of LIGNES) {
        const v = await AsyncStorage.getItem(l.cle);
        valeurs[l.cle] = v !== "false";
      }
      setEtats(valeurs);
    })();
  }, []);

  async function basculer(cle: string) {
    const nouvelleValeur = !etats[cle];
    setEtats((prev) => ({ ...prev, [cle]: nouvelleValeur }));
    await AsyncStorage.setItem(cle, String(nouvelleValeur));
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
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
});