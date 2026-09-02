import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { supabase } from "@/lib/supabase/client";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { EnteteEcran, Badge } from "@/components/UI";

type Facture = { id: string; numero: string; clientNom: string | null; total: number; statut: string; creeLe: Date };

const BADGE_PAR_STATUT: Record<string, "succes" | "attention" | "danger" | "neutre"> = {
  payee: "succes", en_attente: "attention", partiellement_payee: "attention", en_retard: "danger", annulee: "neutre", brouillon: "neutre",
};

export default function Factures() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { formater } = useCurrency();
  const [factures, setFactures] = useState<Facture[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    charger();
  }, []);

  async function charger() {
    setChargement(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setChargement(false); return; }
    const resultats = await database.get("factures" as any).query(Q.where("user_id", user.id), Q.sortBy("cree_le", Q.desc)).fetch();
    setFactures((resultats as any[]).map((f) => ({ id: f.id, numero: f.numero, clientNom: f.clientNom, total: f.total, statut: f.statut, creeLe: f.creeLe })));
    setChargement(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <EnteteEcran titre={t("factures_titre", langue)} onRetour={() => router.back()} />

      {chargement ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : factures.length === 0 ? (
        <View style={styles.etatVide}>
          <Feather name="file-text" size={30} color={colors.textMuted} style={{ marginBottom: 10 }} />
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t("factures_vide", langue)}</Text>
        </View>
      ) : (
        <ScrollView>
          {factures.map((f) => (
            <View key={f.id} style={[styles.ligne, { borderBottomColor: colors.border }]} onTouchEnd={() => router.push(`/factures/${f.id}`)}>
              <View>
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{f.numero}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>{f.clientNom ?? "—"}</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{formater(f.total)}</Text>
                <Badge texte={t(`facture_statut_${f.statut}` as any, langue)} type={BADGE_PAR_STATUT[f.statut] ?? "neutre"} />
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  etatVide: { alignItems: "center", paddingTop: 40 },
  ligne: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1 },
});