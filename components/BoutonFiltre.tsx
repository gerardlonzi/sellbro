import { useState } from "react";
import { Pressable, Text, View, Modal, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";

export type OptionFiltre = { valeur: string; label: string };

export function BoutonFiltre({
  options,
  valeurActive,
  onChange,
}: {
  options: OptionFiltre[];
  valeurActive: string;
  onChange: (v: string) => void;
}) {
  const { colors } = useTheme();
  const [ouvert, setOuvert] = useState(false);
  const actif = valeurActive !== options[0].valeur;

  return (
    <>
      <Pressable
        onPress={() => setOuvert(true)}
        style={[styles.bouton, { borderColor: actif ? colors.accent : colors.border, borderWidth: actif ? 1.5 : 1 }]}
      >
        <Feather name="sliders" size={14} color={actif ? colors.accent : colors.textSecondary} />
        {actif && <View style={[styles.point, { backgroundColor: colors.accent }]} />}
      </Pressable>

      <Modal visible={ouvert} transparent animationType="fade" onRequestClose={() => setOuvert(false)}>
        <Pressable style={styles.fond} onPress={() => setOuvert(false)}>
          <View style={[styles.feuille, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {options.map((o) => {
              const selectionne = valeurActive === o.valeur;
              return (
                <Pressable
                  key={o.valeur}
                  onPress={() => { onChange(o.valeur); setOuvert(false); }}
                  style={[styles.ligne, { borderBottomColor: colors.border }]}
                >
                  <Text style={{ fontSize: 14, color: selectionne ? colors.accent : colors.textPrimary }}>{o.label}</Text>
                  {selectionne && <Feather name="check" size={16} color={colors.accent} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bouton: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center", position: "relative" },
  point: { position: "absolute", top: -3, right: -3, width: 8, height: 8, borderRadius: 4 },
  fond: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  feuille: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, paddingBottom: 30, paddingTop: 10 },
  ligne: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1 },
});