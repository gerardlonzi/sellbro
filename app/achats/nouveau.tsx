import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Modal } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { useLangue, t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase/client";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { enregistrerMouvementStock } from "@/lib/stock/mouvements";
import { EnteteEcran } from "@/components/UI";
import { obtenirUserId } from "@/lib/auth/userCache";
import { synchroniserPourUtilisateurCourant } from "@/lib/database/sync";
import { enregistrerActivite } from "@/lib/audit/journal";
import { peutEcrire } from "@/lib/trial/gate";
import { afficherPaywall } from "@/lib/trial/paywall";

type Produit = { id: string; nom: string };

export default function NouvelAchat() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { showToast } = useToast();
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
    if (chargement) return;
    if (!(await peutEcrire())) {
      afficherPaywall(langue, () => router.push("/premium"));
      return;
    }
    if (!montant) {
      showToast(t("achats_erreur_montant", langue), "error");
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
        a.creeLe = new Date();
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

    synchroniserPourUtilisateurCourant().catch(() => {});
    const libelleAchat = quantiteRecue && nomProduitLie
      ? `Achat enregistré : ${quantiteRecue} × ${nomProduitLie}`
      : `Achat enregistré : ${description.trim() || fournisseur.trim() || "—"}`;
    await enregistrerActivite("achat", "ajout", libelleAchat);
    setChargement(false);
    showToast(t("toast_enregistre", langue), "success");
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
      <EnteteEcran titre={t("achats_titre", langue)} onRetour={() => router.back()} />

      <Champ label={t("achats_fournisseur", langue)} valeur={fournisseur} onChange={setFournisseur} colors={colors} />
      <Champ label={t("achats_description", langue)} valeur={description} onChange={setDescription} colors={colors} />
      <Champ label={t("achats_montant", langue)} valeur={montant} onChange={setMontant} numerique colors={colors} />

      <Text style={styles.label}>{t("achats_lier_produit", langue)}</Text>
      <Pressable onPress={ouvrirSelecteur} style={[styles.selecteur, { borderColor: colors.border }]}>
        <Text style={{ color: nomProduitLie ? colors.textPrimary : colors.textMuted, fontSize: 14 }}>
          {nomProduitLie || t("achats_choisir_produit", langue)}
        </Text>
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </Pressable>

      {produitId && (
        <Champ label={t("achats_quantite_recue", langue)} valeur={quantiteRecue} onChange={setQuantiteRecue} numerique colors={colors} />
      )}

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

      <View style={{ padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }}>
        <Pressable onPress={sauvegarder} disabled={chargement} style={[styles.bouton, { backgroundColor: colors.accent, opacity: chargement ? 0.6 : 1 }]}>
          <Feather name="check" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{chargement ? "..." : t("achats_enregistrer", langue)}</Text>
        </Pressable>
      </View>
    </View>
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