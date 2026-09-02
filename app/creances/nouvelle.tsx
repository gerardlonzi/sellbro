import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase/client";
import { usePlanActuel } from "@/lib/plan/usePlanActuel";
import { EnteteEcran } from "@/components/UI";
import { obtenirUserId } from "@/lib/auth/userCache";

const CHAMPS_SUGGERES = [
  { cle: "note", labelCle: "nouvelle_creance_champ_note" },
  { cle: "produit", labelCle: "nouvelle_creance_champ_produit" },
];

export default function NouvelleCreance() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { plan } = usePlanActuel();
  const { type: typeParam } = useLocalSearchParams<{ type?: string }>();
  const [type, setType] = useState<"creance" | "dette">(typeParam === "dette" ? "dette" : "creance");
  const [personne, setPersonne] = useState("");
  const [telephone, setTelephone] = useState("");
  const [montant, setMontant] = useState("");
  const [echeance, setEcheance] = useState("");
  const [champsActifs, setChampsActifs] = useState<string[]>([]);
  const [valeursChamps, setValeursChamps] = useState<Record<string, string>>({});
  const [chargement, setChargement] = useState(false);

  function basculerChamp(cle: string) {
    setChampsActifs((actuels) => (actuels.includes(cle) ? actuels.filter((c) => c !== cle) : [...actuels, cle]));
  }

  async function sauvegarder() {
    if (!personne.trim() || !montant) {
      Alert.alert("", t("nouvelle_creance_erreur", langue));
      return;
    }

    const userId = await obtenirUserId();
    if (!userId) return;

    setChargement(true);

    // Limite du plan Gratuit : nombre de créances/dettes actives.
    // plan.quotaCreances === null signifie illimité (Starter/Premium).
    if (plan?.quotaCreances) {
      const { count } = await supabase
        .from("creances_dettes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .neq("statut", "payee");

      if (count !== null && count >= plan.quotaCreances) {
        setChargement(false);
        router.push("/premium");
        return;
      }
    }

    await supabase.from("creances_dettes").insert({
      user_id: userId,
      type,
      personne_nom: personne.trim(),
      telephone: telephone.trim() || null,
      montant_initial: Number(montant),
      montant_restant: Number(montant),
      date_echeance: echeance || null,
      statut: "en_cours",
      note: valeursChamps.note || null,
      produit_concerne: valeursChamps.produit || null,
    });

    setChargement(false);
    router.back();
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <EnteteEcran
        titre={type === "creance" ? t("nouvelle_creance_titre", langue) : t("nouvelle_dette_titre", langue)}
        onRetour={() => router.back()}
      />

      <View style={styles.ligneChoix}>
        <Pressable
          onPress={() => setType("creance")}
          style={[styles.choix, { borderColor: type === "creance" ? colors.accent : colors.border, borderWidth: type === "creance" ? 2 : 1 }]}
        >
          <Text style={{ color: type === "creance" ? colors.accent : colors.textPrimary, fontSize: 13 }}>
            {t("nouvelle_creance_type_creance", langue)}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setType("dette")}
          style={[styles.choix, { borderColor: type === "dette" ? colors.accent : colors.border, borderWidth: type === "dette" ? 2 : 1 }]}
        >
          <Text style={{ color: type === "dette" ? colors.accent : colors.textPrimary, fontSize: 13 }}>
            {t("nouvelle_creance_type_dette", langue)}
          </Text>
        </Pressable>
      </View>

      <Champ label={t("nouvelle_creance_personne", langue)} valeur={personne} onChange={setPersonne} placeholder={t("nouvelle_creance_personne_placeholder", langue)} />
      <Champ label={t("nouvelle_creance_telephone", langue)} valeur={telephone} onChange={setTelephone} placeholder="+237 6XX XXX XXX" />
      <Champ label={t("nouvelle_creance_montant", langue)} valeur={montant} onChange={setMontant} placeholder="5000" numerique />
      <Champ label={t("nouvelle_creance_echeance", langue)} valeur={echeance} onChange={setEcheance} placeholder="AAAA-MM-JJ" />

      <Text style={[styles.label, { color: colors.textSecondary, marginTop: 8 }]}>{t("produit_champ_facultatif", langue)}</Text>
      <View style={styles.ligneChamps}>
        {CHAMPS_SUGGERES.map((c) => (
          <Pressable
            key={c.cle}
            onPress={() => basculerChamp(c.cle)}
            style={[styles.pucheChamp, { borderColor: champsActifs.includes(c.cle) ? colors.accent : colors.border, borderWidth: champsActifs.includes(c.cle) ? 2 : 1 }]}
          >
            <Feather name={champsActifs.includes(c.cle) ? "check" : "plus"} size={12} color={champsActifs.includes(c.cle) ? colors.accent : colors.textMuted} />
            <Text style={{ color: champsActifs.includes(c.cle) ? colors.accent : colors.textPrimary, fontSize: 12 }}>{t(c.labelCle as any, langue)}</Text>
          </Pressable>
        ))}
      </View>

      {champsActifs.map((cle) => {
        const info = CHAMPS_SUGGERES.find((c) => c.cle === cle)!;
        return (
          <Champ
            key={cle}
            label={t(info.labelCle as any, langue)}
            valeur={valeursChamps[cle] ?? ""}
            onChange={(v: string) => setValeursChamps((p) => ({ ...p, [cle]: v }))}
            placeholder=""
          />
        );
      })}

      <Pressable
        onPress={sauvegarder}
        disabled={chargement}
        style={[styles.boutonSauver, { backgroundColor: colors.accent, marginTop: 20, opacity: chargement ? 0.6 : 1 }]}
      >
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
          {chargement ? "..." : t("nouvelle_creance_sauver", langue)}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Champ({ label, valeur, onChange, placeholder, numerique }: any) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        value={valeur}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={numerique ? "numeric" : "default"}
        style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 50 },
  label: { fontSize: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  ligneChoix: { flexDirection: "row", gap: 8, marginBottom: 16 },
  choix: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  ligneChamps: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  pucheChamp: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  boutonSauver: { paddingVertical: 14, borderRadius: 8, alignItems: "center" },
});