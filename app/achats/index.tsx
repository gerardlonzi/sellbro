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

type Achat = { id: string; fournisseur_nom: string | null; description: string | null; montant: number; cree_le: number };

export default function Achats() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { formater } = useCurrency();
  const [achats, setAchats] = useState<Achat[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    charger();
  }, []);

  async function charger() {
    setChargement(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setChargement(false); return; }
    const resultats = await database.get("achats").query(Q.where("user_id", user.id), Q.sortBy("cree_le", Q.desc)).fetch();
    setAchats(resultats.map((a: any) => ({ id: a.id, fournisseur_nom: a.fournisseurNom, description: a.description, montant: a.montant, cree_le: a.creeLe.getTime() })));
    setChargement(false);
  }

  const total = achats.reduce((s, a) => s + a.montant, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <EnteteEcran titre="Achats fournisseurs" onRetour={() => router.back()} />

      {!chargement && achats.length > 0 && (
        <View style={[styles.bandeauTotal, { backgroundColor: colors.accentBg }]}>
          <Text style={{ color: colors.accent, fontSize: 12 }}>Total : {formater(total)} ({achats.length})</Text>
        </View>
      )}

      {chargement ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : achats.length === 0 ? (
        <View style={styles.etatVide}>
          <Feather name="truck" size={30} color={colors.textMuted} style={{ marginBottom: 10 }} />
          <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center" }}>Aucun achat enregistré pour l'instant</Text>
        </View>
      ) : (
        <ScrollView>
          {achats.map((a) => (
            <View key={a.id} style={[styles.ligne, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{a.fournisseur_nom ?? "Fournisseur"}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>{new Date(a.cree_le).toLocaleDateString(langue === "fr" ? "fr-FR" : "en-US")}</Text>
              </View>
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{formater(a.montant)}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      <BoutonFlottant onPress={() => router.push("/achats/nouveau")} />
    </View>
  );
}

const styles = StyleSheet.create({
  bandeauTotal: { padding: 10, borderRadius: 10, marginBottom: 12 },
  etatVide: { alignItems: "center", paddingTop: 40 },
  ligne: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1 },
});