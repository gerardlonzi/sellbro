import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, Modal } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { supabase } from "@/lib/supabase/client";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { EnteteEcran } from "@/components/UI";

type Produit = { id: string; nom: string; prixVente: number };
type Client = { nom: string; telephone: string | null };

export default function NouvelleVente() {
  const { colors } = useTheme();
  const [nomProduit, setNomProduit] = useState("");
  const [produitIdLie, setProduitIdLie] = useState<string | null>(null);
  const [quantite, setQuantite] = useState("1");
  const [prixUnitaire, setPrixUnitaire] = useState("");
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
    setProduits(resultats.map((p: any) => ({ id: p.id, nom: p.nom, prixVente: p.prixVente })));
    setSelecteurProduitOuvert(true);
  }

  function importerProduit(p: Produit) {
    setNomProduit(p.nom);
    setProduitIdLie(p.id);
    setPrixUnitaire(String(p.prixVente));
    setSelecteurProduitOuvert(false);
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

  async function sauvegarder() {
    if (!nomProduit.trim() || !quantite || !prixUnitaire) {
      Alert.alert("", "Le produit, la quantité et le prix sont nécessaires.");
      return;
    }
    setChargement(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await database.write(async () => {
      await database.get("ventes").create((v: any) => {
        v.userId = user.id;
        v.produitId = produitIdLie;
        v.produitNom = nomProduit.trim();
        v.quantite = Number(quantite);
        v.prixUnitaire = Number(prixUnitaire);
        v.clientNom = client.trim() || null;
        v.clientTelephone = clientTelephone.trim() || null;
        v.modePaiement = modePaiement;
        v.source = "manuel";
        v.donneesSupplementairesJson = "{}";
        v.synchronise = false;
      });
    });

    setChargement(false);
    router.back();
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <EnteteEcran titre="Nouvelle vente" onRetour={() => router.back()} />

      <Text style={styles.label}>Produit</Text>
      <View style={styles.ligneChampBouton}>
        <TextInput
          value={nomProduit}
          onChangeText={(v) => { setNomProduit(v); setProduitIdLie(null); }}
          placeholder="Nom du produit"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.textPrimary }]}
        />
        <Pressable onPress={ouvrirSelecteurProduit} style={[styles.boutonImporter, { backgroundColor: colors.accentBg }]}>
          <Feather name="package" size={15} color={colors.accent} />
          <Text style={{ color: colors.accent, fontSize: 11 }}>Stock</Text>
        </Pressable>
      </View>

      <View style={styles.ligneDeux}>
        <Champ label="Quantité" valeur={quantite} onChange={setQuantite} numerique colors={colors} style={{ flex: 1 }} />
        <Champ label="Prix unitaire" valeur={prixUnitaire} onChange={setPrixUnitaire} numerique colors={colors} style={{ flex: 1 }} />
      </View>

      <Text style={styles.label}>Client (facultatif)</Text>
      <View style={styles.ligneChampBouton}>
        <TextInput
          value={client}
          onChangeText={setClient}
          placeholder="Nom du client"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.textPrimary }]}
        />
        <Pressable onPress={ouvrirSelecteurClient} style={[styles.boutonImporter, { backgroundColor: colors.accentBg }]}>
          <Feather name="users" size={15} color={colors.accent} />
          <Text style={{ color: colors.accent, fontSize: 11 }}>Clients</Text>
        </Pressable>
      </View>
      <Champ label="Téléphone client (facultatif)" valeur={clientTelephone} onChange={setClientTelephone} colors={colors} />

      <Text style={[styles.label, { marginTop: 4 }]}>Mode de paiement</Text>
      <View style={styles.ligneDeux}>
        {(["cash", "momo", "credit"] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => setModePaiement(m)}
            style={[styles.choix, { borderColor: modePaiement === m ? colors.accent : colors.border, borderWidth: modePaiement === m ? 2 : 1 }]}
          >
            <Text style={{ color: modePaiement === m ? colors.accent : colors.textPrimary, fontSize: 12 }}>
              {m === "cash" ? "Cash" : m === "momo" ? "MoMo" : "Crédit"}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={sauvegarder} disabled={chargement} style={[styles.boutonSauver, { backgroundColor: colors.accent, opacity: chargement ? 0.6 : 1 }]}>
        <Feather name="check" size={16} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{chargement ? "..." : "Enregistrer"}</Text>
      </Pressable>

      {/* Sélecteur produit */}
      <Modal visible={selecteurProduitOuvert} transparent animationType="slide">
        <Pressable style={styles.fondModal} onPress={() => setSelecteurProduitOuvert(false)}>
          <View style={[styles.feuille, { backgroundColor: colors.surface }]}>
            <ScrollView>
              {produits.map((p) => (
                <Pressable key={p.id} onPress={() => importerProduit(p)} style={[styles.ligneChoixModal, { borderBottomColor: colors.border }]}>
                  <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{p.nom}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{p.prixVente.toLocaleString()} F</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Sélecteur client */}
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

function Champ({ label, valeur, onChange, numerique, colors, style }: any) {
  return (
    <View style={[{ marginBottom: 14 }, style]}>
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
  label: { fontSize: 12, marginBottom: 6, color: "#888" },
  ligneChampBouton: { flexDirection: "row", gap: 8, marginBottom: 14 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  boutonImporter: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, borderRadius: 8 },
  ligneDeux: { flexDirection: "row", gap: 10 },
  choix: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  boutonSauver: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 10, marginTop: 10 },
  fondModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  feuille: { maxHeight: "60%", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  ligneChoixModal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1 },
});