import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, Modal } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { supabase } from "@/lib/supabase/client";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { enregistrerMouvementStock } from "@/lib/stock/mouvements";
import { EnteteEcran } from "@/components/UI";
import { obtenirUserId } from "@/lib/auth/userCache";

type Produit = { id: string; nom: string };

export default function NouvelAchat() {
  const { colors } = useTheme();
  const [fournisseur, setFournisseur] = useState("");
  const [description, setDescription] = useState("");
  const [montant, setMontant] = useState("");
  const [produitId, setProduitId] = useState<string | null>(null);
  const [nomProduitLie, setNomProduitLie] = useState("");
  const [quantiteRecue, setQuantiteRecue] = useState("");
  const [chargement, setChargement] = useState(false);
  const [selecteurOuvert, setSelecteurOuvert] = useState(false);
  const [produits, setProduits] = useState<Produit[]>([]);

  async function ouvrirSelecteur() {
    const userId = await obtenirUserId();
    if (!userId) return;
        const resultats = await database.get("produits").query(Q.where("user_id", userId)).fetch();
    setProduits((resultats as any[]).map((p) => ({ id: p.id, nom: p.nom })));
    setSelecteurOuvert(true);
  }

  function choisirProduit(p: Produit) {
    setProduitId(p.id);
    setNomProduitLie(p.nom);
    setSelecteurOuvert(false);
  }

  async function sauvegarder() {
    if (!montant) {
      Alert.alert("", "Le montant est nécessaire.");
      return;
    }
    setChargement(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await database.write(async () => {
      await database.get("achats").create((a: any) => {
        a.userId = user.id;
        a.fournisseurNom = fournisseur.trim() || null;
        a.description = description.trim() || null;
        a.montant = Number(montant);
        a.source = "manuel";
        a.donneesSupplementairesJson = "{}";
        a.synchronise = false;
      });
    });

    // Si l'achat est lié à un produit du stock, on augmente le stock automatiquement.
    if (produitId && quantiteRecue) {
      await enregistrerMouvementStock({
        userId: user.id,
        produitId,
        type: "achat",
        quantite: Number(quantiteRecue),
        raison: fournisseur.trim() ? `Réassort — ${fournisseur.trim()}` : "Réassort",
      });
    }

    setChargement(false);
    router.back();
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <EnteteEcran titre="Nouvel achat" onRetour={() => router.back()} />

      <Champ label="Fournisseur" valeur={fournisseur} onChange={setFournisseur} colors={colors} />
      <Champ label="Description" valeur={description} onChange={setDescription} colors={colors} />
      <Champ label="Montant" valeur={montant} onChange={setMontant} numerique colors={colors} />

      <Text style={styles.label}>Lier à un produit du stock (facultatif)</Text>
      <Pressable onPress={ouvrirSelecteur} style={[styles.selecteur, { borderColor: colors.border }]}>
        <Text style={{ color: nomProduitLie ? colors.textPrimary : colors.textMuted, fontSize: 14 }}>
          {nomProduitLie || "Choisir un produit"}
        </Text>
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </Pressable>

      {produitId && (
        <Champ label="Quantité reçue" valeur={quantiteRecue} onChange={setQuantiteRecue} numerique colors={colors} />
      )}

      <Pressable onPress={sauvegarder} disabled={chargement} style={[styles.bouton, { backgroundColor: colors.accent, opacity: chargement ? 0.6 : 1 }]}>
        <Feather name="check" size={16} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{chargement ? "..." : "Enregistrer"}</Text>
      </Pressable>

      <Modal visible={selecteurOuvert} transparent animationType="slide">
        <Pressable style={styles.fondModal} onPress={() => setSelecteurOuvert(false)}>
          <View style={[styles.feuille, { backgroundColor: colors.surface }]}>
            <ScrollView>
              {produits.map((p) => (
                <Pressable key={p.id} onPress={() => choisirProduit(p)} style={[styles.ligneChoix, { borderBottomColor: colors.border }]}>
                  <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{p.nom}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function Champ({ label, valeur, onChange, numerique, colors }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={valeur}
        onChangeText={onChange}
        keyboardType={numerique ? "numeric" : "default"}
        style={{ borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 50 },
  label: { fontSize: 12, marginBottom: 8, color: "#888" },
  selecteur: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 14 },
  bouton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 10, marginTop: 10 },
  fondModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  feuille: { maxHeight: "60%", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  ligneChoix: { paddingVertical: 12, borderBottomWidth: 1 },
});