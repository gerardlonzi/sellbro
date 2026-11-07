import { ReactNode, useEffect, useRef } from "react";
import { Animated, Easing, Image, ImageBackground, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput as RNTextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Text, TextInput } from "@/components/Texte";
import { Apparition, PressableAnime } from "@/components/anim";
import { fondPremium } from "@/lib/theme/fonds";
import { useTheme } from "@/lib/theme/ThemeProvider";

// Cadre commun des écrans d'accès (connexion, code, inscription, boutique) :
// fond d'image premium (clair / sombre), voile, logo, titre et carte « verre »
// qui contient le formulaire. Le texte est blanc au-dessus du fond, sombre/clair
// dans la carte selon le thème.
export function EcranAuth({
  titre, sousTitre, children, retour = true, pied,
}: { titre: string; sousTitre?: string; children: ReactNode; retour?: boolean; pied?: ReactNode }) {
  const { isDark, colors } = useTheme();
  const flottement = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const boucle = Animated.loop(Animated.sequence([
      Animated.timing(flottement, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(flottement, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    boucle.start();
    return () => boucle.stop();
  }, [flottement]);

  return (
    <View style={{ flex: 1, backgroundColor: "#0B3D33" }}>
      <ImageBackground source={fondPremium("welcome", isDark)} resizeMode="cover" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={isDark ? ["rgba(8,24,20,0.35)", "rgba(8,24,20,0.85)"] : ["rgba(11,61,51,0.25)", "rgba(11,61,51,0.7)"]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {retour && (
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.retour}>
              <Feather name="arrow-left" size={20} color="#fff" />
            </Pressable>
          )}
          <Apparition>
            <Animated.View style={[styles.tuile, { transform: [{ translateY: flottement.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }]}>
              <Image source={require("../assets/logo-mark.png")} style={{ width: 52, height: 52 }} resizeMode="contain" />
            </Animated.View>
            <Text style={styles.titre}>{titre}</Text>
            {sousTitre ? <Text style={styles.sousTitre}>{sousTitre}</Text> : null}
          </Apparition>
          <Apparition delai={120}>
            <View style={[styles.carte, { backgroundColor: isDark ? "rgba(18,28,25,0.82)" : "rgba(255,255,255,0.94)", borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.7)" }]}>
              {children}
            </View>
          </Apparition>
          {pied ? <Apparition delai={220}><View style={{ marginTop: 18, alignItems: "center" }}>{pied}</View></Apparition> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// Champ de saisie avec icône et focus animé.
export function ChampAuth({
  icone, valeur, onChange, placeholder, ...reste
}: { icone: keyof typeof Feather.glyphMap; valeur: string; onChange: (v: string) => void; placeholder?: string } & Omit<React.ComponentProps<typeof RNTextInput>, "value" | "onChange" | "onChangeText" | "placeholder">) {
  const { colors } = useTheme();
  const focus = useRef(new Animated.Value(0)).current;
  const vers = (v: number) => Animated.timing(focus, { toValue: v, duration: 160, useNativeDriver: false }).start();
  return (
    <Animated.View
      style={[styles.champ, {
        backgroundColor: colors.background,
        borderColor: focus.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.accent] }),
      }]}
    >
      <Feather name={icone} size={18} color={colors.textMuted} />
      <TextInput
        {...reste}
        value={valeur}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        onFocus={(e) => { vers(1); reste.onFocus?.(e); }}
        onBlur={(e) => { vers(0); reste.onBlur?.(e); }}
        style={{ flex: 1, color: colors.textPrimary, fontSize: 15.5, paddingVertical: 14 }}
      />
    </Animated.View>
  );
}

// Saisie du code de vérification en cases séparées (un TextInput invisible
// capte la frappe et le collage ; les cases ne font qu'afficher).
export function ChampCode({ valeur, onChange, longueur = 6 }: { valeur: string; onChange: (v: string) => void; longueur?: number }) {
  const { colors } = useTheme();
  const ref = useRef<RNTextInput>(null);
  const cases = Math.max(longueur, valeur.length);
  return (
    <Pressable onPress={() => ref.current?.focus()} style={styles.codeLigne}>
      {Array.from({ length: cases }).map((_, i) => {
        const actif = i === valeur.length;
        return (
          <View key={i} style={[styles.codeCase, { backgroundColor: colors.background, borderColor: actif ? colors.accent : valeur[i] ? colors.accentClair : colors.border }]}>
            <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "800" }}>{valeur[i] ?? ""}</Text>
          </View>
        );
      })}
      <RNTextInput
        ref={ref}
        value={valeur}
        onChangeText={(v) => onChange(v.replace(/\D/g, "").slice(0, 8))}
        keyboardType="number-pad"
        autoFocus
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={8}
        style={styles.codeCache}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, justifyContent: "center", padding: 22, paddingTop: 70, paddingBottom: 40 },
  retour: { position: "absolute", top: 50, left: 4, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center", zIndex: 5 },
  tuile: { width: 84, height: 84, borderRadius: 26, backgroundColor: "#fff", alignSelf: "center", alignItems: "center", justifyContent: "center", marginBottom: 18, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  titre: { color: "#fff", fontSize: 27, fontWeight: "800", letterSpacing: -0.5, textAlign: "center" },
  sousTitre: { color: "rgba(255,255,255,0.8)", fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 8, marginBottom: 22, paddingHorizontal: 6 },
  carte: { borderRadius: 28, padding: 20, borderWidth: 1 },
  champ: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 14, marginBottom: 14 },
  codeLigne: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 18 },
  codeCase: { width: 42, height: 54, borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  codeCache: { position: "absolute", opacity: 0.01, width: "100%", height: "100%" },
});
