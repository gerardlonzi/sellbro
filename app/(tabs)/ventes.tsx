import { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { supabase } from "@/lib/supabase/client";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { MenuContextuel } from "@/components/MenuContextuel";
import { BoutonFlottant } from "@/components/BoutonFlottant";

type Vente = { id: string; quantite: number; prixUnitaire: number; clientNom: string | null; source: string; creeLe: Date };
const ICONES_SOURCE: Record<string, any> = { vocal: "mic", scan: "camera", manuel: "edit-3" };

export default function Ventes() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { formater } = useCurrency();
  const [recherche, setRecherche] = useState("");
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    charger();
  }, []);

  async function charger() {
    setChargement(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setChargement(false); return; }

    const resultats = await database.get("ventes").query(Q.where("user_id", user.id), Q.sortBy("cree_le", Q.desc)).fetch();
    setVentes((resultats as any[]).map((v) => ({
      id: v.id, quantite: v.quantite, prixUnitaire: v.prixUnitaire,
      clientNom: v.clientNom, source: v.source, creeLe: v.creeLe,
    })));
    setChargement(false);
  }

  const filtrees = ventes.filter((v) => (v.clientNom ?? "").toLowerCase().includes(recherche.toLowerCase()));
  const total = filtrees.reduce((s, v) => s + v.quantite * v.prixUnitaire, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <Text style={{ fontSize: 16, fontWeight: "500", color: colors.textPrimary, marginBottom: 12 }}>{t("tab_ventes", langue)}</Text>

      <TextInput
        placeholder={t("commandes_recherche", langue)}
        placeholderTextColor={colors.textMuted}
        value={recherche}
        onChangeText={setRecherche}
        style={[styles.recherche, { borderColor: colors.border, color: colors.textPrimary }]}
      />

      {!chargement && filtrees.length > 0 && (
        <View style={[styles.bandeauTotal, { backgroundColor: colors.accentBg }]}>
          <Text style={{ color: colors.accent, fontSize: 12 }}>{t("commandes_total", langue)} : {formater(total)} ({filtrees.length})</Text>
        </View>
      )}

      {chargement ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : filtrees.length === 0 ? (
        <View style={styles.etatVide}>
          <Feather name="shopping-bag" size={30} color={colors.textMuted} style={{ marginBottom: 10 }} />
          <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center" }}>{t("commandes_vide", langue)}</Text>
        </View>
      ) : (
        <ScrollView>
          {filtrees.map((v) => (
            <View key={v.id} style={[styles.ligne, { borderBottomColor: colors.border }]}>
              <View style={styles.ligneGauche}>
                <Feather name={ICONES_SOURCE[v.source] ?? "edit-3"} size={14} color={colors.textMuted} />
                <View>
                  <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{v.clientNom ?? "—"}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>{v.creeLe.toLocaleDateString(langue === "fr" ? "fr-FR" : "en-US")}</Text>
                </View>
              </View>
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500", marginRight: 10 }}>{formater(v.quantite * v.prixUnitaire)}</Text>
              <MenuContextuel actions={[{ label: t("categories_supprimer_confirmer", langue), icone: "trash-2", destructif: true, onPress: async () => {
                const enreg = await database.get("ventes").find(v.id);
                await database.write(async () => { await (enreg as any).destroyPermanently(); });
                charger();
              } }]} />
            </View>
          ))}
        </ScrollView>
      )}

      <BoutonFlottant onPress={() => router.push("/vente/nouvelle")} />
    </View>
  );
}

const styles = StyleSheet.create({
  recherche: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, marginBottom: 10 },
  bandeauTotal: { padding: 10, borderRadius: 10, marginBottom: 12 },
  etatVide: { alignItems: "center", paddingTop: 40 },
  ligne: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1 },
  ligneGauche: { flexDirection: "row", alignItems: "center", gap: 10 },
});