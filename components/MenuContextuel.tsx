import { useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";

export type ActionMenu = { label: string; icone: keyof typeof Feather.glyphMap; destructif?: boolean; onPress: () => void };

export function MenuContextuel({ actions }: { actions: ActionMenu[] }) {
  const { colors } = useTheme();
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      <Pressable onPress={() => setOuvert(true)} hitSlop={10}>
        <Feather name="more-vertical" size={16} color={colors.textMuted} />
      </Pressable>

      <Modal visible={ouvert} transparent animationType="fade" onRequestClose={() => setOuvert(false)}>
        <Pressable style={styles.fond} onPress={() => setOuvert(false)}>
          <View style={[styles.feuille, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {actions.map((a, i) => (
              <Pressable
                key={a.label}
                onPress={() => { setOuvert(false); a.onPress(); }}
                style={[styles.ligne, i < actions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              >
                <Feather name={a.icone} size={16} color={a.destructif ? colors.danger : colors.textPrimary} />
                <Text style={{ fontSize: 14, color: a.destructif ? colors.danger : colors.textPrimary }}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  feuille: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, paddingBottom: 30, paddingTop: 6 },
  ligne: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 15 },
});