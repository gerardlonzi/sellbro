import { useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t, Langue } from "@/lib/i18n";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { obtenirUserId } from "@/lib/auth/userCache";
import { EnteteEcran } from "@/components/UI";
import { formaterDateHeure } from "@/lib/formatDate";

type Entree = { id: string; type: string; action: string; description: string; creeLe: Date };

const ICONES: Record<string, keyof typeof Feather.glyphMap> = {
  vente: "shopping-bag",
  achat: "truck",
  creance: "arrow-down-left",
  produit: "package",
  depense: "credit-card",
  fournisseur: "users",
  facture: "file-text",
  stock: "box",
};

// Libellés traduits pour les actions et les types (avec repli sur la valeur brute).
function libelleAction(action: string, langue: Langue): string {
  const cle = `journal_action_${action}` as any;
  return t(cle, langue) ?? action;
}
function libelleType(type: string, langue: Langue): string {
  const cle = `journal_type_${type}` as any;
  return t(cle, langue) ?? type;
}

export default function Journal() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const [entrees, setEntrees] = useState<Entree[]>([]);
  const [chargement, setChargement] = useState(true);
  const [filtreType, setFiltreType] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [])
  );

  async function charger() {
    setChargement(true);
    const userId = await obtenirUserId();
    if (!userId) { setChargement(false); return; }
    const resultats = await database.get("journal_activite").query(Q.where("user_id", userId), Q.sortBy("cree_le", Q.desc)).fetch();
    setEntrees((resultats as any[]).map((j) => ({ id: j.id, type: j.type, action: j.action, description: j.description, creeLe: j.creeLe })));
    setChargement(false);
  }

  const types = [...new Set(entrees.map((e) => e.type))];
  const filtrees = filtreType ? entrees.filter((e) => e.type === filtreType) : entrees;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <EnteteEcran titre={t("journal_titre", langue)} onRetour={() => router.back()} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, maxHeight: 34 }}>
        <FiltrePuce label={t("journal_tous", langue)} actif={!filtreType} onPress={() => setFiltreType(null)} colors={colors} />
        {types.map((type) => (
          <FiltrePuce key={type} label={libelleType(type, langue)} actif={filtreType === type} onPress={() => setFiltreType(type)} colors={colors} />
        ))}
      </ScrollView>

      {chargement ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : filtrees.length === 0 ? (
        <View style={{ alignItems: "center", paddingTop: 40 }}>
          <Feather name="list" size={30} color={colors.textMuted} style={{ marginBottom: 10 }} />
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t("journal_vide", langue)}</Text>
        </View>
      ) : (
        <ScrollView>
          {filtrees.map((e) => (
            <View key={e.id} style={[styles.ligne, { borderBottomColor: colors.border }]}>
              <View style={[styles.icone, { backgroundColor: colors.accentBg }]}>
                <Feather name={ICONES[e.type] ?? "activity"} size={15} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{e.description}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                  {formaterDateHeure(e.creeLe, langue)}
                </Text>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>{libelleAction(e.action, langue)}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function FiltrePuce({ label, actif, onPress, colors }: any) {
  return (
    <Pressable onPress={onPress} style={[styles.puce, { borderColor: actif ? colors.accent : colors.border, borderWidth: actif ? 1.5 : 1 }]}>
      <Text style={{ color: actif ? colors.accent : colors.textSecondary, fontSize: 11 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  icone: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  puce: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginRight: 6 },
});