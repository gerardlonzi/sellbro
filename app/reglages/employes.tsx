import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { usePlanActuel } from "@/lib/plan/usePlanActuel";
import { supabase } from "@/lib/supabase/client";
import { EnteteEcran, BoutonPrimaire } from "@/components/UI";

type Employe = { id: string; nom: string; telephone: string | null; role: string };

export default function Employes() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { plan } = usePlanActuel();
  const [employes, setEmployes] = useState<Employe[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (plan?.multiEmployes) charger();
    else setChargement(false);
  }, [plan?.multiEmployes]);

  async function charger() {
    setChargement(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setChargement(false); return; }
    const { data } = await supabase.from("employes").select("*").eq("proprietaire_id", user.id);
    setEmployes(data ?? []);
    setChargement(false);
  }

  if (plan && !plan.multiEmployes) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16, paddingTop: 50 }}>
        <EnteteEcran titre={t("employes_titre", langue)} onRetour={() => router.back()} />
        <View style={{ alignItems: "center", marginTop: 60, paddingHorizontal: 20 }}>
          <View style={[styles.icone, { backgroundColor: colors.proBg }]}>
            <Feather name="users" size={24} color={colors.pro} />
          </View>
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textPrimary, marginTop: 14, textAlign: "center" }}>
            {t("limite_titre_fonctionnalite", langue)}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: "center", marginTop: 6, marginBottom: 20 }}>
            {t("employes_desc_verrouille", langue)}
          </Text>
          <BoutonPrimaire texte={t("limite_bouton_forfaits", langue)} onPress={() => router.push("/premium")} couleur={colors.proFill} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingTop: 50 }}>
      <EnteteEcran titre={t("employes_titre", langue)} onRetour={() => router.back()} />
      {!chargement && employes.length === 0 ? (
        <View style={{ alignItems: "center", marginTop: 40 }}>
          <Feather name="user-plus" size={28} color={colors.textMuted} />
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 10, marginBottom: 20 }}>{t("employes_vide", langue)}</Text>
          <BoutonPrimaire texte={t("employes_ajouter", langue)} onPress={() => {}} />
        </View>
      ) : (
        <>
          {employes.map((e) => (
            <View key={e.id} style={[styles.ligneEmploye, { borderBottomColor: colors.border }]}>
              <View style={[styles.avatar, { backgroundColor: colors.accentBg }]}>
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "500" }}>{e.nom.slice(0, 2).toUpperCase()}</Text>
              </View>
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500", flex: 1 }}>{e.nom}</Text>
              <Feather name="more-vertical" size={16} color={colors.textMuted} />
            </View>
          ))}
          <BoutonPrimaire texte={t("employes_ajouter", langue)} onPress={() => {}} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  icone: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  ligneEmploye: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});