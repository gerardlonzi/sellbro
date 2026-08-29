import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, Modal } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase/client";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { EnteteEcran } from "@/components/UI";

type Produit = { id: string; nom: string; prixVente: number; quantiteStock: number };
type LigneVente = { produitId: string | null; nom: string; quantite: number; prixUnitaire: number };
type Client = { nom: string; telephone: string | null };

export default function NouvelleVente() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const [panier, setPanier] = useState<LigneVente[]>([]);
  const [client, setClient] = useState("");
  const [clientTelephone, setClientTelephone] = useState("");
  const [modePaiement, setModePaiement] = useState<"cash" | "momo" | "credit">("cash");
  const [chargement, setChargement] = useState(false);
  const [selecteurProduitOuvert, setSelecteurProduitOuvert] = useState(false);
  const [selecteurClientOuvert, setSelecteurClientOuvert] = useState(false);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  async function ouvrirSelecteurProduit() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const resultats = await database.get("produits").query(Q.where("user_id", user.id)).fetch();
    setProduits((resultats as any[]).map((p) => ({ id: p.id, nom: p.nom, prixVente: p.prixVente, quantiteStock: p.quantiteStock })));
    setSelecteurProduitOuvert(true);
  }

  function ajouterAuPanier(p: Produit) {
    setPanier((actuel) => {
      const existant = actuel.find((l) => l.produitId === p.id);
      if (existant) {
        return actuel.map((l) => (l.produitId === p.id ? { ...l, quantite: l.quantite + 1 } : l));
      }
      return [...actuel, { produitId: p.id, nom: p.nom, quantite: 1, prixUnitaire: p.prixVente }];
    });
    setSelecteurProduitOuvert(false);
  }

  function modifierQuantite(index: number, delta: number) {
    setPanier((actuel) =>
      actuel.map((l, i) => (i === index ? { ...l, quantite: Math.max(1, l.quantite + delta) } : l))
    );
  }

  function retirerDuPanier(index: number) {
    setPanier((actuel) => actuel.filter((_, i) => i !== index));
  }

  async function ouvrirSelecteurClient() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const ventes = await database.get("ventes").query(Q.where("user_id", user.id)).fetch();
    const nomsVus = new Map<string, Client>();
    (ventes as any[]).forEach((v) => {
      if (v.clientNom && !nomsVus.has(v.clientNom)) nomsVus.set(v.clientNom, { nom: v.clientNom, telephone: v.clientTelephone });
    });
    setClients(Array.from(nomsVus.values()));
    setSelecteurClientOuvert(true);
  }

  function importerClient(c: Client) {
    setClient(c.nom);
    setClientTelephone(c.telephone ?? "");
    setSelecteurClientOuvert(false);
  }

  const total = panier.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);

  async function sauvegarder() {
    if (panier.length === 0) {
      Alert.alert("", t("vente_panier_vide", langue));
      return;
    }

    setChargement(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await database.write(async () => {
      for (const ligne of panier) {
        await database.get("ventes").create((v: any) => {
          v.userId = user.id;
          v.produitId = ligne.produitId;
          v.produitNom = ligne.nom;
          v.quantite = ligne.quantite;
          v.prixUnitaire = ligne.prixUnitaire;
          v.clientNom = client.trim() || null;
          v.clientTelephone = clientTelephone.trim() || null;
          v.modePaiement = modePaiement;
          v.source = "manuel";
          v.donneesSupplementairesJson = "{}";
          v.synchronise = false;
        });
      }
    });

    setChargement(false);
    router.back();
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <EnteteEcran titre={t("vente_nouvelle_titre", langue)} onRetour={() => router.back()} />

      <Text style={styles.label}>{t("vente_produits", langue)}</Text>
      {panier.map((ligne, i) => (
        <View key={i} style={[styles.lignePanier, { borderColor: colors.border }]}>
          <Text style={{ color: colors.textPrimary, fontSize: 13, flex: 1 }}>{ligne.nom}</Text>
          <Pressable onPress={() => modifierQuantite(i, -1)} style={styles.boutonQte}>
            <Feather name="minus" size={14} color={colors.textPrimary} />
          </Pressable>
          <Text style={{ width: 24, textAlign: "center", color: colors.textPrimary, fontSize: 13 }}>{ligne.quantite}</Text>
          <Pressable onPress={() => modifierQuantite(i, 1)} style={styles.boutonQte}>
            <Feather name="plus" size={14} color={colors.textPrimary} />
          </Pressable>
          <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500", width: 70, textAlign: "right" }}>
            {(ligne.quantite * ligne.prixUnitaire).toLocaleString()}
          </Text>
          <Pressable onPress={() => retirerDuPanier(i)} hitSlop={8}>
            <Feather name="x" size={16} color={colors.danger} />
          </Pressable>
        </View>
      ))}

      <Pressable onPress={ouvrirSelecteurProduit} style={[styles.boutonAjouterProduit, { borderColor: colors.accent }]}>
        <Feather name="plus" size={15} color={colors.accent} />
        <Text style={{ color: colors.accent, fontSize: 13 }}>{t("vente_ajouter_produit", langue)}</Text>
      </Pressable>

      {panier.length > 0 && (
        <View style={[styles.bandeauTotal, { backgroundColor: colors.accentBg }]}>
          <Text style={{ color: colors.accent, fontSize: 14, fontWeight: "600" }}>{t("vente_total", langue)} : {total.toLocaleString()} F</Text>
        </View>
      )}

      <Text style={styles.label}>{t("vente_client_facultatif", langue)}</Text>
      <View style={styles.ligneChampBouton}>
        <TextInput
          value={client}
          onChangeText={setClient}
          placeholder={t("vente_nom_client", langue)}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.textPrimary }]}
        />
        <Pressable onPress={ouvrirSelecteurClient} style={[styles.boutonImporter, { backgroundColor: colors.accentBg }]}>
          <Feather name="users" size={15} color={colors.accent} />
        </Pressable>
      </View>

      <Text style={[styles.label, { marginTop: 4 }]}>{t("vente_mode_paiement", langue)}</Text>
      <View style={styles.ligneDeux}>
        {(["cash", "momo", "credit"] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => setModePaiement(m)}
            style={[styles.choix, { borderColor: modePaiement === m ? colors.accent : colors.border, borderWidth: modePaiement === m ? 2 : 1 }]}
          >
            <Text style={{ color: modePaiement === m ? colors.accent : colors.textPrimary, fontSize: 12 }}>
              {t(`vente_paiement_${m}` as any, langue)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={sauvegarder} disabled={chargement} style={[styles.boutonSauver, { backgroundColor: colors.accent, opacity: chargement ? 0.6 : 1 }]}>
        <Feather name="check" size={16} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{chargement ? "..." : t("vente_enregistrer", langue)}</Text>
      </Pressable>

      <Modal visible={selecteurProduitOuvert} transparent animationType="slide">
        <Pressable style={styles.fondModal} onPress={() => setSelecteurProduitOuvert(false)}>
          <View style={[styles.feuille, { backgroundColor: colors.surface }]}>
            <ScrollView>
              {produits.map((p) => (
                <Pressable key={p.id} onPress={() => ajouterAuPanier(p)} style={[styles.ligneChoixModal, { borderBottomColor: colors.border }]}>
                  <View>
                    <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{p.nom}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>{t("vente_en_stock_court", langue)} {p.quantiteStock}</Text>
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{p.prixVente.toLocaleString()} F</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={selecteurClientOuvert} transparent animationType="slide">
        <Pressable style={styles.fondModal} onPress={() => setSelecteurClientOuvert(false)}>
          <View style={[styles.feuille, { backgroundColor: colors.surface }]}>
            <ScrollView>
              {clients.map((c) => (
                <Pressable key={c.nom} onPress={() => importerClient(c)} style={[styles.ligneChoixModal, { borderBottomColor: colors.border }]}>
                  <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{c.nom}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 50 },
  label: { fontSize: 12, marginBottom: 8, color: "#888" },
  lignePanier: { flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, paddingVertical: 8 },
  boutonQte: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  boutonAjouterProduit: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderStyle: "dashed", borderRadius: 8, paddingVertical: 11, marginTop: 8, marginBottom: 14 },
  bandeauTotal: { padding: 12, borderRadius: 10, marginBottom: 16, alignItems: "center" },
  ligneChampBouton: { flexDirection: "row", gap: 8, marginBottom: 14 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  boutonImporter: { width: 42, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  ligneDeux: { flexDirection: "row", gap: 10 },
  choix: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  boutonSauver: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 10, marginTop: 10 },
  fondModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  feuille: { maxHeight: "60%", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  ligneChoixModal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1 },
});