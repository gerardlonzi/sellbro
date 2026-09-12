import { useState } from "react";
import { ScrollView, Pressable, Text, View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { PeriodeId } from "@/lib/periode/periodes";
import { Plan, periodesAutorisees } from "@/lib/plan/quotas";
import { LimitePopup } from "./LimitePopup";

const PERIODES: { id: PeriodeId; cle: string }[] = [
  { id: "jour", cle: "periode_jour" },
  { id: "semaine", cle: "periode_semaine" },
  { id: "mois", cle: "periode_mois" },
  { id: "semestre", cle: "periode_semestre" },
  { id: "annee", cle: "periode_annee" },
];

export function SelecteurPeriode({ periode, onChange, plan, personnalise, onPersonnalise }: { periode: PeriodeId; onChange: (p: PeriodeId) => void; plan: Plan | undefined; personnalise?: boolean; onPersonnalise?: () => void }) {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const autorisees = periodesAutorisees(plan);
  const [afficherLimite, setAfficherLimite] = useState(false);

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.conteneur}
        contentContainerStyle={{ alignItems: "center", gap: 8 }}
      >
        {onPersonnalise && (
          <Pressable
            onPress={onPersonnalise}
            style={[styles.puce, { flexDirection:"row", alignItems:"center" ,borderColor: personnalise ? colors.accent : colors.border, borderWidth: personnalise ? 1.5 : 1 }]}
          >
            <Feather name="calendar" size={12} color={personnalise ? colors.accent : colors.textSecondary} style={{ marginRight: 4 }} />
            <Text style={{ fontSize: 12, color: personnalise ? colors.accent : colors.textSecondary }}>{t("dashboard_personnalise", langue)}</Text>
          </Pressable>
        )}
        {PERIODES.map((p) => {
          const actif = periode === p.id;
          const verrouille = !autorisees.includes(p.id);
          return (
            <Pressable
              key={p.id}
              onPress={() => (verrouille ? setAfficherLimite(true) : onChange(p.id))}
              style={[styles.puce, { borderColor: actif ? colors.accent : colors.border, borderWidth: actif ? 1.5 : 1, opacity: verrouille ? 0.6 : 1 }]}
            >
              <Text style={{ fontSize: 12, color: actif ? colors.accent : colors.textSecondary }}>{t(p.cle as any, langue)}</Text>
              {verrouille && (
                <View style={[styles.badgeEtoile, { backgroundColor: colors.proFill }]}>
                  <Feather name="star" size={8} color={colors.onPro} />
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <LimitePopup visible={afficherLimite} type="fonctionnalite" onFermer={() => setAfficherLimite(false)} />
            </>
  );
}

const styles = StyleSheet.create({
  conteneur: { maxHeight: 34, marginBottom: 12},
  puce: { position: "relative", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  badgeEtoile: { position: "absolute", top: -5, right: -5, width: 14, height: 14, borderRadius: 7, alignItems: "center", justifyContent: "center" },
});