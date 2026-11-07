import { ReactNode, useState } from "react";
import { KeyboardTypeOptions, StyleSheet, TextInputProps, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Text, TextInput } from "@/components/Texte";
import { Apparition, PressableAnime } from "@/components/anim";
import { BoutonPrimaire, ombre } from "@/components/UI";
import { PuceIcone, TonPuce } from "@/components/PuceIcone";
import { useTheme } from "@/lib/theme/ThemeProvider";

// Briques de formulaire communes : même hauteur, même rayon, même focus
// partout dans l'app.

export function SectionForm({ titre, icone, ton = "vert", children, delai = 0 }: { titre: string; icone: keyof typeof Feather.glyphMap; ton?: TonPuce; children: ReactNode; delai?: number }) {
  const { colors } = useTheme();
  return (
    <Apparition delai={delai}>
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }, ombre(colors, 1)]}>
        <View style={styles.enteteSection}>
          <PuceIcone icone={icone} ton={ton} taille={28} />
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "700" }}>{titre}</Text>
        </View>
        {children}
      </View>
    </Apparition>
  );
}

export function ChampTexte({
  label, icone, valeur, onChange, placeholder, clavier, multiligne, suffixe, ...reste
}: {
  label: string; icone?: keyof typeof Feather.glyphMap; valeur: string; onChange: (v: string) => void;
  placeholder?: string; clavier?: KeyboardTypeOptions; multiligne?: boolean; suffixe?: string;
} & Omit<TextInputProps, "onChange" | "value" | "onChangeText" | "placeholder" | "keyboardType" | "multiline">) {
  const { colors } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginBottom: 6, marginLeft: 2 }}>{label}</Text>
      <View style={[styles.champ, { backgroundColor: colors.background, borderColor: focus ? colors.accent : colors.border, alignItems: multiligne ? "flex-start" : "center" }]}>
        {icone && <Feather name={icone} size={16} color={focus ? colors.accent : colors.textMuted} style={{ marginTop: multiligne ? 12 : 0 }} />}
        <TextInput
          value={valeur}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={clavier}
          multiline={multiligne}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{ flex: 1, color: colors.textPrimary, fontSize: 15, paddingVertical: 12, minHeight: multiligne ? 80 : undefined, textAlignVertical: multiligne ? "top" : "center" }}
          {...reste}
        />
        {suffixe ? <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: "600" }}>{suffixe}</Text> : null}
      </View>
    </View>
  );
}

// Choix unique sous forme de pastilles (mode de paiement, délai, récurrence…).
export function PucesChoix<T extends string>({
  label, options, valeur, onChange,
}: { label?: string; options: { id: T; libelle: string; icone?: keyof typeof Feather.glyphMap }[]; valeur: T | null; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginBottom: 8, marginLeft: 2 }}>{label}</Text> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => {
          const actif = valeur === o.id;
          return (
            <PressableAnime
              key={o.id}
              onPress={() => onChange(o.id)}
              echelle={0.94}
              style={[styles.puce, { backgroundColor: actif ? colors.accent : colors.background, borderColor: actif ? colors.accent : colors.border }]}
            >
              {o.icone && <Feather name={o.icone} size={13} color={actif ? "#fff" : colors.textSecondary} />}
              <Text style={{ color: actif ? "#fff" : colors.textSecondary, fontSize: 12.5, fontWeight: actif ? "700" : "500" }}>{o.libelle}</Text>
            </PressableAnime>
          );
        })}
      </View>
    </View>
  );
}

// Barre d'action fixée en bas : bouton principal animé.
export function BarreSauvegarde({ texte, onPress, chargement }: { texte: string; onPress: () => void; chargement?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.barre, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
      <BoutonPrimaire texte={chargement ? "…" : texte} icone="check" onPress={onPress} disabled={chargement} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderWidth: 1, borderRadius: 22, padding: 16, marginBottom: 14 },
  enteteSection: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  champ: { flexDirection: "row", gap: 10, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14 },
  puce: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  barre: { padding: 16, paddingBottom: 26, borderTopWidth: 1 },
});
