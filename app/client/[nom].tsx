import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { obtenirUserId } from "@/lib/auth/userCache";
import { EnteteEcran, Carte } from "@/components/UI";
import { usePays } from "@/lib/pays/PaysProvider";
import { validerTelephone } from "@/lib/pays/validation";
import { genererFichierFacturePdf } from "@/lib/export/genererPdf";
import { synchroniserPourUtilisateurCourant } from "@/lib/database/sync";
import * as Sharing from "expo-sharing";
import * as Linking from "expo-linking";

type StatsClient = {
  telephone: string | null;
  nbAchats: number;
  total: number;
  produitPrefere: { nom: string; quantite: number } | null;
};

export default function FicheClient() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { formater } = useCurrency();
  const { showToast } = useToast();
  const { pays } = usePays();
  const { nom } = useLocalSearchParams<{ nom: string }>();
  const [stats, setStats] = useState<StatsClient | null>(null);
  const [chargement, setChargement] = useState(true);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [modalNumeroOuvert, setModalNumeroOuvert] = useState(false);
  const [numeroSaisi, setNumeroSaisi] = useState("");

  useEffect(() => {
    charger();
  }, [nom]);

  async function charger() {
    setChargement(true);
    const userId = await obtenirUserId();
    if (!userId) { setChargement(false); return; }

    const ventes = await database.get("ventes").query(Q.where("user_id", userId)).fetch();
    const duClient = (ventes as any[]).filter((v) => v.clientNom === nom);

    let telephone: string | null = null;
    let total = 0;
    const parProduit: Record<string, number> = {};

    for (const v of duClient) {
      if (v.clientTelephone) telephone = v.clientTelephone;
      total += v.quantite * v.prixUnitaire;
      const nomProduit = v.produitNom ?? "—";
      parProduit[nomProduit] = (parProduit[nomProduit] ?? 0) + v.quantite;
    }

    const produitPrefere = Object.entries(parProduit)
      .map(([n, q]) => ({ nom: n, quantite: q }))
      .sort((a, b) => b.quantite - a.quantite)[0] ?? null;

    setStats({ telephone, nbAchats: duClient.length, total, produitPrefere });
    setChargement(false);
  }

  // Envoie la dernière facture du client via WhatsApp. Le numéro est
  // obligatoire : s'il manque, on le demande et on l'enregistre avant l'envoi.
  async function envoyerParWhatsapp() {
    if (envoiEnCours) return;
    if (!stats?.telephone) {
      // Pas de numéro connu : on ouvre la saisie. L'envoi reprendra après.
      setNumeroSaisi("");
      setModalNumeroOuvert(true);
      return;
    }
    await envoyer(stats.telephone);
  }

  // Enregistre le numéro saisi sur TOUTES les ventes du client (il est stocké
  // sur les ventes, il n'existe pas de table « clients »), puis envoie.
  async function enregistrerNumeroEtEnvoyer() {
    const validation = validerTelephone(numeroSaisi.trim(), pays);
    if (!validation.valide) {
      showToast(validation.message ?? t("inscription_verifie_numero", langue), "error");
      return;
    }
    const telephoneComplet = `${pays.indicatif}${numeroSaisi.replace(/\s/g, "")}`;

    setEnvoiEnCours(true);
    try {
      const userId = await obtenirUserId();
      if (!userId) return;
      const ventes = (await database.get("ventes").query(Q.where("user_id", userId)).fetch()) as any[];
      const duClient = ventes.filter((v) => v.clientNom === nom && !v.clientTelephone);
      await database.write(async () => {
        for (const v of duClient) {
          await v.update((x: any) => {
            x.clientTelephone = telephoneComplet;
            x.synchronise = false;
          });
        }
      });
      synchroniserPourUtilisateurCourant().catch(() => {});
      setStats((s) => (s ? { ...s, telephone: telephoneComplet } : s));
      setModalNumeroOuvert(false);
      await envoyer(telephoneComplet);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function envoyer(telephone: string) {
    setEnvoiEnCours(true);
    try {
      const userId = await obtenirUserId();
      if (!userId) return;

      // La dernière facture du client (la plus récente).
      const factures = (await database.get("factures" as any).query(Q.where("user_id", userId), Q.sortBy("cree_le", Q.desc)).fetch()) as any[];
      const facture = factures.find((f) => f.clientNom === nom);
      if (!facture) {
        showToast(t("client_aucune_facture", langue), "error");
        return;
      }
      const lignes = await database.get("facture_lignes" as any).query(Q.where("facture_id", facture.id)).fetch();

      const uri = await genererFichierFacturePdf(facture, lignes, langue);

      // 1) Le PDF part dans la feuille de partage (WhatsApp y est proposé).
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `${t("factures_titre", langue)} ${facture.numero}`,
        });
      }
      // 2) La conversation WhatsApp du client s'ouvre avec un message prêt —
      //    il ne reste qu'à y joindre le PDF partagé.
      const numero = telephone.replace(/[^0-9]/g, "");
      const message = encodeURIComponent(`${t("factures_titre", langue)} ${facture.numero}`);
      await Linking.openURL(`https://wa.me/${numero}?text=${message}`).catch(() => {});
    } finally {
      setEnvoiEnCours(false);
    }
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
      <EnteteEcran titre={nom ?? ""} onRetour={() => router.back()} />

      <View style={[styles.avatar, { backgroundColor: colors.accentBg }]}>
        <Text style={{ color: colors.accent, fontSize: 22, fontWeight: "600" }}>{(nom ?? "?").slice(0, 2).toUpperCase()}</Text>
      </View>

      <Carte style={{ marginTop: 16, gap: 12 }}>
        <Ligne label={t("client_telephone", langue)} valeur={stats?.telephone ?? "—"} colors={colors} />
        <Ligne label={t("client_nb_achats", langue)} valeur={`${stats?.nbAchats ?? 0}`} colors={colors} />
        <Ligne label={t("client_total", langue)} valeur={formater(stats?.total ?? 0)} colors={colors} />
        <Ligne
          label={t("client_produit_prefere", langue)}
          valeur={stats?.produitPrefere ? `${stats.produitPrefere.nom} (×${stats.produitPrefere.quantite})` : "—"}
          colors={colors}
          dernier
        />
      </Carte>

      {/* Envoi de la dernière facture par WhatsApp, au numéro du client. */}
      <Pressable
        onPress={envoyerParWhatsapp}
        disabled={envoiEnCours}
        style={[styles.boutonWhatsapp, { backgroundColor: "#25D366", opacity: envoiEnCours ? 0.6 : 1 }]}
      >
        {envoiEnCours ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Feather name="message-circle" size={16} color="#fff" />
        )}
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{t("client_envoyer_whatsapp", langue)}</Text>
      </Pressable>

      {/* Saisie du numéro s'il n'est pas connu : enregistré puis utilisé. */}
      <Modal visible={modalNumeroOuvert} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={styles.fondModal}>
            <View style={[styles.carteModal, { backgroundColor: colors.surface }]}>
              <View style={[styles.iconeModal, { backgroundColor: colors.puceVertBg }]}>
                <Feather name="phone" size={22} color={colors.puceVert} />
              </View>
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "600", textAlign: "center" }}>
                {t("client_numero_requis_titre", langue)}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center", marginTop: 6, lineHeight: 19 }}>
                {t("client_numero_requis_texte", langue)(nom ?? "")}
              </Text>
              <TextInput
                value={numeroSaisi}
                onChangeText={setNumeroSaisi}
                placeholder={t("client_numero_placeholder", langue)}
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                autoFocus
                style={[styles.saisie, { borderColor: colors.border, color: colors.textPrimary }]}
              />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16, alignSelf: "stretch" }}>
                <Pressable onPress={() => setModalNumeroOuvert(false)} style={[styles.boutonModal, { borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "500" }}>{t("popup_annuler", langue)}</Text>
                </Pressable>
                <Pressable onPress={enregistrerNumeroEtEnvoyer} style={[styles.boutonModal, { backgroundColor: "#25D366" }]}>
                  <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{t("client_numero_enregistrer", langue)}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

function Ligne({ label, valeur, colors, dernier }: any) {
  return (
    <View style={[styles.ligne, !dernier && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{valeur}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 50 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  ligne: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  boutonWhatsapp: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20, paddingVertical: 13, borderRadius: 10 },
  fondModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  carteModal: { width: "100%", maxWidth: 340, borderRadius: 16, padding: 24, alignItems: "center" },
  iconeModal: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  saisie: { alignSelf: "stretch", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, marginTop: 16 },
  boutonModal: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: "center" },
});
