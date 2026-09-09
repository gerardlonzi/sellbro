import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator, Image } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { enregistrerActivite } from "@/lib/audit/journal";

export default function DetailProduit() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [chargement, setChargement] = useState(true);
  const [nom, setNom] = useState("");
  const [prixVente, setPrixVente] = useState("");
  const [prixAchat, setPrixAchat] = useState("");
  const [quantite, setQuantite] = useState("");
  const [seuilAlerte, setSeuilAlerte] = useState("");
  const [champsSupp, setChampsSupp] = useState<Record<string, string>>({});
  const [stats, setStats] = useState({ nbVentes: 0, ca: 0, benefice: 0, topClients: [] as { nom: string; montant: number }[] });

  useEffect(() => {
    charger();
  }, [id]);

  async function charger() {
    setChargement(true);
    const p = (await database.get("produits").find(id)) as any;
    if (p) {
      setNom(p.nom);
      setPrixVente(String(p.prixVente));
      setPrixAchat(p.prixAchat != null ? String(p.prixAchat) : "");
      setQuantite(String(p.quantiteStock));
      setSeuilAlerte(String(p.seuilAlerte));
      setChampsSupp(p.champsSupplementaires ?? {});
    }

    // Stats de vente de ce produit.
    const ventes = await database.get("ventes").query(Q.where("produit_id", id)).fetch();
    const ventesList = ventes as any[];
    const nbVentes = ventesList.reduce((s, v) => s + v.quantite, 0);
    const ca = ventesList.reduce((s, v) => s + v.quantite * v.prixUnitaire, 0);
    const clientsMap: Record<string, number> = {};
    for (const v of ventesList) {
      if (v.clientNom) clientsMap[v.clientNom] = (clientsMap[v.clientNom] ?? 0) + v.quantite * v.prixUnitaire;
    }
    const topClients = Object.entries(clientsMap).map(([nom, montant]) => ({ nom, montant })).sort((a, b) => b.montant - a.montant).slice(0, 3);
    setStats({ nbVentes, ca, benefice: Math.round(ca * 0.3), topClients });

    setChargement(false);
  }

  async function sauvegarder() {
    const p = await database.get("produits").find(id);
    await database.write(async () => {
      await (p as any).update((x: any) => {
        x.nom = nom;
        x.prixVente = Number(prixVente);
        x.prixAchat = Number(prixAchat) || null;
        x.quantiteStock = Number(quantite) || 0;
        x.seuilAlerte = Number(seuilAlerte) || 5;
      });
    });
    router.back();
  }

  function confirmerSuppression() {
    Alert.alert(t("categories_supprimer_confirmer", langue), "", [
      { text: t("popup_non", langue), style: "cancel" },
      {
        text: t("categories_supprimer_confirmer", langue),
        style: "destructive",
        onPress: async () => {
          const p = await database.get("produits").find(id);
          await database.write(async () => { await (p as any).destroyPermanently(); });
          await enregistrerActivite("produit", "suppression", `Produit supprimé : ${nom}`);
          router.back();
        },
      },
    ]);
  }

  if (chargement) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View style={styles.entete}>
        <Pressable onPress={() => router.back()}>
          <Feather name="x" size={20} color={colors.textSecondary} />
        </Pressable>
        <Text style={{ fontSize: 14, fontWeight: "500", color: colors.textPrimary }}>{nom}</Text>
        <Pressable onPress={sauvegarder}>
          <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "500" }}>{t("produit_sauver", langue)}</Text>
        </Pressable>
        <Pressable onPress={() => router.push(`/produit/mouvements/${id}`)} style={{ marginLeft: 12 }}>
  <Feather name="clock" size={18} color={colors.textSecondary} />
</Pressable>
      </View>

      {/* Statistiques du produit */}
      <View style={[styles.blocChamps, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Statistiques</Text>
        <View style={styles.ligneChamp}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Ventes</Text>
          <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{stats.nbVentes}</Text>
        </View>
        <View style={styles.ligneChamp}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Chiffre d'affaires</Text>
          <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{stats.ca.toLocaleString()} F</Text>
        </View>
        <View style={styles.ligneChamp}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Bénéfice estimé</Text>
          <Text style={{ color: colors.success, fontSize: 13, fontWeight: "500" }}>{stats.benefice.toLocaleString()} F</Text>
        </View>
        {stats.topClients.length > 0 && (
          <View style={{ marginTop: 6 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Meilleurs clients</Text>
            {stats.topClients.map((c) => (
              <View key={c.nom} style={styles.ligneChamp}>
                <Text style={{ color: colors.textPrimary, fontSize: 12 }}>{c.nom}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{c.montant.toLocaleString()} F</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {(champsSupp.images ? JSON.parse(champsSupp.images) : champsSupp.image_uri ? [champsSupp.image_uri] : []).map((uri: string, i: number) => (
        <Image key={i} source={{ uri }} style={styles.imageProduit} />
      ))}

      {Object.keys(champsSupp).length > 0 && (
        <View style={[styles.blocChamps, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {champsSupp.couleur ? (
            <View style={styles.ligneChamp}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t("produit_champ_couleur", langue)}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={[styles.pastilleCouleur, { backgroundColor: champsSupp.couleur }]} />
                <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{champsSupp.couleur}</Text>
              </View>
            </View>
          ) : null}
          {champsSupp.poids ? (
            <View style={styles.ligneChamp}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t("produit_champ_poids", langue)}</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{champsSupp.poids}</Text>
            </View>
          ) : null}
          {champsSupp.remarque ? (
            <View style={styles.ligneChamp}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t("produit_champ_remarque", langue)}</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{champsSupp.remarque}</Text>
            </View>
          ) : null}
          {champsSupp.description ? (
            <View style={styles.ligneChamp}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t("produit_champ_description", langue)}</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{champsSupp.description}</Text>
            </View>
          ) : null}
          {champsSupp.reference ? (
            <View style={styles.ligneChamp}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t("produit_champ_reference", langue)}</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{champsSupp.reference}</Text>
            </View>
          ) : null}
        </View>
      )}

      <Champ label={t("produit_nom_label", langue)} valeur={nom} onChange={setNom} colors={colors} />
      <View style={styles.ligneDeux}>
        <Champ label={t("produit_prix_vente", langue)} valeur={prixVente} onChange={setPrixVente} numerique colors={colors} style={{ flex: 1 }} />
        <Champ label={t("produit_prix_achat", langue)} valeur={prixAchat} onChange={setPrixAchat} numerique colors={colors} style={{ flex: 1 }} />
      </View>
      <View style={styles.ligneDeux}>
        <Champ label={t("produit_quantite", langue)} valeur={quantite} onChange={setQuantite} numerique colors={colors} style={{ flex: 1 }} />
        <Champ label={t("produit_seuil", langue)} valeur={seuilAlerte} onChange={setSeuilAlerte} numerique colors={colors} style={{ flex: 1 }} />
      </View>

      <Pressable onPress={confirmerSuppression} style={[styles.boutonSupprimer, { backgroundColor: colors.dangerBg, marginTop: 20 }]}>
        <Feather name="trash-2" size={15} color={colors.danger} />
        <Text style={{ color: colors.danger, fontSize: 13, fontWeight: "500" }}>{t("categories_supprimer_confirmer", langue)}</Text>
      </Pressable>
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
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  ligneDeux: { flexDirection: "row", gap: 10 },
  boutonSupprimer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 8 },
  imageProduit: { width: "100%", height: 160, borderRadius: 12, marginBottom: 16 },
  blocChamps: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 },
  ligneChamp: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  pastilleCouleur: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: "#00000022" },
});