import { ReactNode } from "react";
import { ImageBackground, StyleSheet, View, ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "@/components/Texte";
import { Apparition } from "@/components/anim";
import { ombre } from "@/components/UI";
import { PuceIcone, TonPuce } from "@/components/PuceIcone";
import { fondPremium } from "@/lib/theme/fonds";
import { useTheme } from "@/lib/theme/ThemeProvider";

// Briques visuelles partagées par le tableau de bord (Aperçu + Prévisions).

// Titre de section : petit trait d'accent + libellé.
export function TitreSection({ texte, delai = 0 }: { texte: string; delai?: number }) {
  const { colors } = useTheme();
  return (
    <Apparition delai={delai} style={styles.titreLigne}>
      <View style={[styles.trait, { backgroundColor: colors.accent }]} />
      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.7, textTransform: "uppercase" }}>{texte}</Text>
    </Apparition>
  );
}

// Carte de section avec en-tête (pastille d'icône + titre + action facultative).
export function CarteSection({
  icone, ton = "vert", titre, droite, children, style, delai = 0,
}: { icone: keyof typeof Feather.glyphMap; ton?: TonPuce; titre: string; droite?: ReactNode; children: ReactNode; style?: ViewStyle; delai?: number }) {
  const { colors } = useTheme();
  return (
    <Apparition delai={delai}>
      <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border }, ombre(colors, 1), style]}>
        <View style={styles.enteteCarte}>
          <PuceIcone icone={icone} ton={ton} taille={30} />
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "700", flex: 1 }}>{titre}</Text>
          {droite}
        </View>
        {children}
      </View>
    </Apparition>
  );
}

// Tuile chiffre clé : pastille, valeur (se réduit si le montant est long), libellé.
export function TuileKpi({
  icone, ton, valeur, libelle, couleurValeur, tendance, style,
}: { icone: keyof typeof Feather.glyphMap; ton: TonPuce; valeur: string; libelle: string; couleurValeur?: string; tendance?: ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tuile, { backgroundColor: colors.surface, borderColor: colors.border }, ombre(colors, 1), style]}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <PuceIcone icone={icone} ton={ton} taille={30} />
        {tendance}
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ color: couleurValeur ?? colors.textPrimary, fontSize: 20, fontWeight: "800", marginTop: 12 }}>{valeur}</Text>
      <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "500", marginTop: 3 }}>{libelle}</Text>
    </View>
  );
}

// Bloc héros : chiffre d'affaires de la période sur fond d'image, avec les
// sous-indicateurs en bas. Texte blanc quel que soit le mode (voile vert).
export function HeroStats({
  libelle, valeur, variation, sous,
}: { libelle: string; valeur: string; variation?: { pct: number | null; hausse: boolean | null }; sous: { icone: keyof typeof Feather.glyphMap; libelle: string; valeur: string }[] }) {
  const { isDark } = useTheme();
  return (
    <View style={styles.hero}>
      <ImageBackground source={fondPremium("welcome", true)} resizeMode="cover" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={isDark ? ["rgba(8,40,33,0.55)", "rgba(12,20,18,0.88)"] : ["rgba(20,145,122,0.55)", "rgba(11,61,51,0.88)"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}
      />
      <View style={styles.cercle} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12.5, fontWeight: "600" }}>{libelle}</Text>
        {variation && variation.hausse !== null && (
          <View style={[styles.variation, { backgroundColor: variation.hausse ? "rgba(47,208,174,0.25)" : "rgba(255,122,112,0.28)" }]}>
            <Feather name={variation.hausse ? "trending-up" : "trending-down"} size={11} color="#fff" />
            {variation.pct !== null && <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{variation.pct > 0 ? "+" : ""}{variation.pct} %</Text>}
          </View>
        )}
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55} style={{ color: "#fff", fontSize: 34, fontWeight: "800", letterSpacing: -0.8, marginTop: 6 }}>{valeur}</Text>
      <View style={styles.sousLigne}>
        {sous.map((s, i) => (
          <View key={s.libelle} style={[styles.sous, i > 0 && { borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.18)", paddingLeft: 14 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Feather name={s.icone} size={12} color="rgba(255,255,255,0.75)" />
              <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, flexShrink: 1 }}>{s.libelle}</Text>
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={{ color: "#fff", fontSize: 16, fontWeight: "800", marginTop: 3 }}>{s.valeur}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Ligne de classement : rang, nom, valeur et barre de proportion.
export function LigneClassement({
  rang, nom, detail, valeur, part, dernier,
}: { rang: number; nom: string; detail?: string; valeur: string; part: number; dernier?: boolean }) {
  const { colors } = useTheme();
  const medailles = ["#F5B942", "#A8B3AF", "#D08A5B"];
  return (
    <View style={[styles.ligneClass, !dernier && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <View style={[styles.rang, { backgroundColor: rang < 3 ? medailles[rang] : colors.accentBg }]}>
        <Text style={{ color: rang < 3 ? "#2A1D00" : colors.accent, fontSize: 11, fontWeight: "800" }}>{rang + 1}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600", flex: 1 }}>{nom}</Text>
          <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "800" }}>{valeur}</Text>
        </View>
        <View style={[styles.piste, { backgroundColor: colors.accentBg }]}>
          <View style={{ width: `${Math.max(4, Math.min(100, part * 100))}%`, height: "100%", borderRadius: 3, backgroundColor: colors.accent }} />
        </View>
        {detail ? <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>{detail}</Text> : null}
      </View>
    </View>
  );
}

// Pastille de gravité (jours restants, variation…).
export function Pastille({ texte, ton }: { texte: string; ton: "danger" | "warning" | "success" | "neutre" }) {
  const { colors } = useTheme();
  const map = {
    danger: [colors.dangerBg, colors.danger], warning: [colors.warningBg, colors.warning],
    success: [colors.successBg ?? colors.accentBg, colors.success], neutre: [colors.accentBg, colors.textSecondary],
  } as const;
  return (
    <View style={{ backgroundColor: map[ton][0], paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 }}>
      <Text style={{ color: map[ton][1], fontSize: 11, fontWeight: "800" }}>{texte}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titreLigne: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 22, marginBottom: 10, marginLeft: 2 },
  trait: { width: 3, height: 13, borderRadius: 2 },
  carte: { borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 12 },
  enteteCarte: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  tuile: { flex: 1, borderWidth: 1, borderRadius: 20, padding: 14 },
  hero: { borderRadius: 24, overflow: "hidden", padding: 20, backgroundColor: "#0B3D33", marginBottom: 12 },
  cercle: { position: "absolute", width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(255,255,255,0.06)", top: -70, right: -50 },
  variation: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  sousLigne: { flexDirection: "row", marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.16)" },
  sous: { flex: 1 },
  ligneClass: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  rang: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  piste: { height: 5, borderRadius: 3, marginTop: 6, overflow: "hidden" },
});
