// app/(auth)/connexion.tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase/client";
import { useTheme } from "@/lib/theme/ThemeProvider";

export default function Connexion() {
  const { colors } = useTheme();
  const [etape, setEtape] = useState<"numero" | "code">("numero");
  const [numero, setNumero] = useState("");
  const [code, setCode] = useState("");
  const [chargement, setChargement] = useState(false);

  async function envoyerCode() {
    setChargement(true);
    const telephoneComplet = `+237${numero.replace(/\s/g, "")}`;
    const { error } = await supabase.auth.signInWithOtp({ phone: telephoneComplet });
    setChargement(false);

    if (error) {
      Alert.alert("Ça n'a pas marché", "Vérifie ton numéro et réessaie.");
      return;
    }
    setEtape("code");
  }

  async function verifierCode() {
    setChargement(true);
    const telephoneComplet = `+237${numero.replace(/\s/g, "")}`;
    const { error } = await supabase.auth.verifyOtp({
      phone: telephoneComplet,
      token: code,
      type: "sms",
    });
    setChargement(false);

    if (error) {
      Alert.alert("Code incorrect", "Vérifie le code reçu par SMS.");
      return;
    }
    router.replace("/(tabs)/accueil");
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.titre, { color: colors.textPrimary }]}>Se connecter</Text>

      {etape === "numero" ? (
        <>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>
            Numéro de téléphone
          </Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
            placeholder="6XX XXX XXX"
            keyboardType="phone-pad"
            value={numero}
            onChangeText={setNumero}
          />
          <Pressable
            onPress={envoyerCode}
            disabled={chargement}
            style={[styles.bouton, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.boutonTexte}>{chargement ? "..." : "Recevoir le code"}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>
            Code reçu par SMS
          </Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
            placeholder="123456"
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
          />
          <Pressable
            onPress={verifierCode}
            disabled={chargement}
            style={[styles.bouton, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.boutonTexte}>{chargement ? "..." : "Confirmer"}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
  titre: { fontSize: 18, fontWeight: "500", marginBottom: 24, textAlign: "center" },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 16 },
  bouton: { paddingVertical: 13, borderRadius: 8, alignItems: "center" },
  boutonTexte: { color: "#fff", fontSize: 14, fontWeight: "500" },
});