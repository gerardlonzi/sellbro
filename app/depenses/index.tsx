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
import { EnteteEcran } from "@/components/UI";
import { BoutonFlottant } from "@/components/BoutonFlottant";

type Depense = { id: string; categorie: string; description: string | null; montant: number; creeLe: Date };

export default function Depenses() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { formater } = useCurrency();
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    charger();
  }, []);

  async function charger() {
    setChargement(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setChargement(false); return; }
    const resultats = await database.get("depenses").query(Q.where("user_id", user.id), Q.sortBy("cree_le", Q.desc)).fetch();
    setDepenses((resultats as any[]).map((d) => ({ id: d.id, categorie: d.categorie, description: d.description, montant: d.montant, creeLe: d.creeLe })));
    setChargement(false);
  }

  const total = depenses.reduce((s, d) => s + d.montant, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <EnteteEcran titre={t("depenses_titre", langue)} onRetour={() => router.back()} />

      {!chargement && depenses.length > 0 && (
        <View style={[styles.bandeauTotal, { backgroundColor: colors.dangerBg }]}>
          <Text style={{ color: colors.danger, fontSize: 12 }}>Total : {formater(total)} ({depenses.length})</Text>
        </View>
      )}

      {chargement ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : depenses.length === 0 ? (
        <View style={styles.etatVide}>
          <Feather name="credit-card" size={30} color={colors.textMuted} style={{ marginBottom: 10 }} />
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t("depenses_vide", langue)}</Text>
        </View>
      ) : (
        <ScrollView>
          {depenses.map((d) => (
            <View key={d.id} style={[styles.ligne, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{t(`depense_cat_${d.categorie}` as any, langue)}</Text>
                {d.description && <Text style={{ color: colors.textMuted, fontSize: 11 }}>{d.description}</Text>}
              </View>
              <Text style={{ color: colors.danger, fontSize: 13, fontWeight: "500" }}>{formater(d.montant)}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      <BoutonFlottant onPress={() => router.push("/depenses/nouvelle")} />
    </View>
  );
}

const styles = StyleSheet.create({
  bandeauTotal: { padding: 10, borderRadius: 10, marginBottom: 12 },
  etatVide: { alignItems: "center", paddingTop: 40 },
  ligne: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1 },
});