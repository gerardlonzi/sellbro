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

type Fournisseur = { id: string; nom: string; telephone: string | null; montantDu: number };

export default function Fournisseurs() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { formater } = useCurrency();
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    charger();
  }, []);

  async function charger() {
    setChargement(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setChargement(false); return; }
    const resultats = await database.get("fournisseurs").query(Q.where("user_id", user.id)).fetch();
    setFournisseurs((resultats as any[]).map((f) => ({ id: f.id, nom: f.nom, telephone: f.telephone, montantDu: f.montantDu })));
    setChargement(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <EnteteEcran titre={t("fournisseurs_titre", langue)} onRetour={() => router.back()} />

      {chargement ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : fournisseurs.length === 0 ? (
        <View style={styles.etatVide}>
          <Feather name="truck" size={30} color={colors.textMuted} style={{ marginBottom: 10 }} />
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t("fournisseurs_vide", langue)}</Text>
        </View>
      ) : (
        <ScrollView>
          {fournisseurs.map((f) => (
            <View key={f.id} style={[styles.ligne, { borderBottomColor: colors.border }]}>
              <View style={[styles.avatar, { backgroundColor: colors.accentBg }]}>
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "500" }}>{f.nom.slice(0, 2).toUpperCase()}</Text>
              </View>
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500", flex: 1 }}>{f.nom}</Text>
              {f.montantDu > 0 && (
                <Text style={{ color: colors.danger, fontSize: 12 }}>{t("fournisseurs_du", langue)} {formater(f.montantDu)}</Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <BoutonFlottant onPress={() => router.push("/fournisseurs/nouveau")} />
    </View>
  );
}

const styles = StyleSheet.create({
  etatVide: { alignItems: "center", paddingTop: 40 },
  ligne: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
});