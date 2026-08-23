import { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { supabase } from "@/lib/supabase/client";
import { BoutonPrimaire, BoutonSecondaire, Carte } from "@/components/UI";
import { extraireVenteDepuisTexte } from "@/lib/ai/extraction";

// Écran commun au vocal ET au scan — obligatoire avant toute validation,
// comme décidé : jamais d'enregistrement automatique sans confirmation.
export default function Confirmation() {
  const { colors } = useTheme();
  const { source, texteExtrait } = useLocalSearchParams<{ source: string; texteExtrait?: string }>();


  // TODO : remplacer par les vraies valeurs extraites par l'IA
  // (lib/ai/extraction.ts). Ce sont des valeurs de démonstration.
  const [produit, setProduit] = useState("Savon");
  const [quantite, setQuantite] = useState("5");
  const [prixUnitaire, setPrixUnitaire] = useState("500");
  const [client, setClient] = useState("Paul");
  const [modePaiement, setModePaiement] = useState<"cash" | "momo" | "credit">("cash");

  async function validerVente() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("ventes").insert({
      user_id: user.id,
      quantite: Number(quantite),
      prix_unitaire: Number(prixUnitaire),
      client_nom: client,
      mode_paiement: modePaiement,
      source: source ?? "manuel",
    });

    router.replace("/(tabs)/accueil");
  }

  const total = Number(quantite) * Number(prixUnitaire) || 0;

const extraction = texteExtrait
  ? extraireVenteDepuisTexte(texteExtrait, ["Savon", "Riz", "Huile", "Sucre"]) // TODO: remplacer par les vrais noms de produits de l'utilisateur
  : null;


  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={{ fontSize: 15, fontWeight: "500", color: colors.textPrimary, marginBottom: 4 }}>
        Confirme ta vente
      </Text>
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 16 }}>
        Vérifie et corrige si besoin
      </Text>

      <Carte style={{ marginBottom: 16 }}>
        <ChampLigne label="Produit" valeur={produit} onChange={setProduit} />
        <ChampLigne label="Quantité" valeur={quantite} onChange={setQuantite} numerique />
        <ChampLigne label="Prix unitaire" valeur={prixUnitaire} onChange={setPrixUnitaire} numerique />
        <ChampLigne label="Client" valeur={client} onChange={setClient} dernier />
      </Carte>

      <View style={[styles.bandeauTotal, { backgroundColor: colors.accentBg }]}>
        <Text style={{ color: colors.accent, fontSize: 12 }}>
          Total : {total.toLocaleString()} FCFA
        </Text>
      </View>

      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
        Mode de paiement
      </Text>
      <View style={styles.lignePaiement}>
        {(["cash", "momo", "credit"] as const).map((mode) => (
          <Pressable
            key={mode}
            onPress={() => setModePaiement(mode)}
            style={[
              styles.boutonPaiement,
              {
                borderColor: modePaiement === mode ? colors.accent : colors.border,
                borderWidth: modePaiement === mode ? 2 : 1,
              },
            ]}
          >
            <Text style={{ color: modePaiement === mode ? colors.accent : colors.textPrimary, fontSize: 12 }}>
              {mode === "cash" ? "Cash" : mode === "momo" ? "MoMo" : "Crédit"}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ marginTop: 24, gap: 10 }}>
        <BoutonPrimaire texte="Valider la vente" onPress={validerVente} />
        <BoutonSecondaire texte="Réenregistrer" onPress={() => router.back()} />
      </View>
    </View>
  );
}

function ChampLigne({
  label,
  valeur,
  onChange,
  numerique,
  dernier,
}: {
  label: string;
  valeur: string;
  onChange: (v: string) => void;
  numerique?: boolean;
  dernier?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.champLigne, !dernier && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{label}</Text>
      <TextInput
        value={valeur}
        onChangeText={onChange}
        keyboardType={numerique ? "numeric" : "default"}
        style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "500", textAlign: "right", minWidth: 80 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 60 },
  champLigne: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  bandeauTotal: { padding: 10, borderRadius: 10, marginBottom: 16 },
  lignePaiement: { flexDirection: "row", gap: 8 },
  boutonPaiement: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
});
