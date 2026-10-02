import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { enregistrerActivite } from "@/lib/audit/journal";
import { peutEcrire } from "@/lib/trial/gate";
import { afficherPaywall } from "@/lib/trial/paywall";
import { supprimerEnregistrement } from "@/lib/database/supprimer";
import { EnteteEcran } from "@/components/UI";

import { genererRecuPdf } from "@/lib/export/genererPdf";

type Vente = {
  id: string; quantite: number; prix_unitaire: number; produit_nom: string | null; client_nom: string | null;
  client_telephone: string | null; mode_paiement: string | null; source: string; audio_url: string | null; created_at: string;
};

export default function DetailTransaction() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { showToast } = useToast();
  const { formater } = useCurrency();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vente, setVente] = useState<Vente | null>(null);
  const [lignesTransaction, setLignesTransaction] = useState<{ nom: string; quantite: number; prixUnitaire: number }[]>([]);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    charger();
  }, [id]);

  async function charger() {
    setChargement(true);
    const v = (await database.get("ventes").find(id)) as any;
    // Toutes les lignes de la même transaction : le reçu couvre tout le panier,
    // pas seulement la ligne touchée.
    let transactionId: string | null = null;
    try { transactionId = JSON.parse(v.donneesSupplementairesJson || "{}").transactionId ?? null; } catch {}
    if (transactionId) {
      const toutes = (await database.get("ventes").query(Q.where("user_id", v.userId)).fetch()) as any[];
      setLignesTransaction(
        toutes
          .filter((x) => {
            try { return JSON.parse(x.donneesSupplementairesJson || "{}").transactionId === transactionId; } catch { return false; }
          })
          .map((x) => ({ nom: x.produitNom ?? "—", quantite: x.quantite, prixUnitaire: x.prixUnitaire }))
      );
    } else {
      setLignesTransaction([{ nom: v.produitNom ?? "—", quantite: v.quantite, prixUnitaire: v.prixUnitaire }]);
    }
    setVente({
      id: v.id, quantite: v.quantite, prix_unitaire: v.prixUnitaire, produit_nom: v.produitNom, client_nom: v.clientNom,
      client_telephone: v.clientTelephone ?? null,
      mode_paiement: v.modePaiement, source: v.source, audio_url: v.audioUrl,
      created_at: v.creeLe ? v.creeLe.toISOString() : new Date().toISOString(),
    });
    setChargement(false);
  }

  async function supprimer() {
    Alert.alert(t("categories_supprimer_confirmer", langue), "", [
      { text: t("popup_non", langue), style: "cancel" },
      {
        text: t("categories_supprimer_confirmer", langue),
        style: "destructive",
        onPress: async () => {
          if (enregistrement) return;
          if (!(await peutEcrire())) { afficherPaywall(langue, () => router.push("/premium")); return; }
          setEnregistrement(true);
          try {
            const enreg = await database.get("ventes").find(id);
            const nomProduit = (enreg as any).produitNom ?? "produit";
            const quantite = (enreg as any).quantite ?? 1;
            await database.write(async () => { await supprimerEnregistrement("ventes", enreg as any); });
            await enregistrerActivite("vente", "suppression", `Vente supprimée : ${quantite} × ${nomProduit}`);
            showToast(t("toast_supprime", langue), "success");
            router.back();
          } finally {
            setEnregistrement(false);
          }
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

  if (!vente) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
        <EnteteEcran titre="—" onRetour={() => router.back()} />
      </View>
    );
  }

  // Le total affiché couvre TOUTE la transaction (toutes les lignes du panier),
  // pas seulement la ligne touchée — sinon le reçu et l'écran ne concordent pas.
  const total = lignesTransaction.length > 0
    ? lignesTransaction.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0)
    : vente.quantite * vente.prix_unitaire;

  // Partage le reçu de la transaction au client (format ticket 80 mm).
  async function partagerRecu() {
    if (enregistrement) return;
    setEnregistrement(true);
    try {
      await genererRecuPdf(vente!.client_nom, vente!.client_telephone, lignesTransaction, total, langue);
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16, paddingTop: 50 }}>
      <EnteteEcran titre={t("commandes_titre", langue)} onRetour={() => router.back()} />

      <View style={{ alignItems: "center", paddingVertical: 16 }}>
        <Text style={{ fontSize: 26, fontWeight: "700", color: colors.textPrimary }}>{formater(total)}</Text>
        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
          {new Date(vente.created_at).toLocaleString(langue === "fr" ? "fr-FR" : "en-US")}
        </Text>
      </View>

      <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ligne label="Produit" valeur={vente.produit_nom ?? "—"} colors={colors} />
        <Ligne label={t("nouvelle_creance_montant", langue)} valeur={`${vente.quantite} × ${formater(vente.prix_unitaire)}`} colors={colors} />
        <Ligne label={t("nouvelle_creance_personne", langue)} valeur={vente.client_nom ?? "—"} colors={colors} dernier />
      </View>

      <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
        <Ligne label={t("commandes_paiement_tous", langue) && "Paiement"} valeur={vente.mode_paiement ?? "—"} colors={colors} />
        <Ligne
          label="Source"
          valeur=""
          colors={colors}
          icone={vente.source === "vocal" ? "mic" : vente.source === "scan" ? "camera" : "edit-3"}
          dernier
        />
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
        {/* Reçu : génère le ticket PDF et ouvre la feuille de partage
            (WhatsApp, SMS, imprimante thermique…). */}
        <Pressable style={[styles.boutonAction, { backgroundColor: colors.accent }]} onPress={partagerRecu} disabled={enregistrement}>
          <Feather name="share-2" size={15} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>{t("recu_partager", langue)}</Text>
        </Pressable>
        <Pressable style={[styles.boutonAction, { backgroundColor: colors.dangerBg }]} onPress={supprimer}>
          <Feather name="trash-2" size={15} color={colors.danger} />
          <Text style={{ color: colors.danger, fontSize: 13 }}>{t("categories_supprimer_confirmer", langue)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Ligne({ label, valeur, colors, icone, dernier }: any) {
  return (
    <View style={[styles.ligne, !dernier && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Text style={{ fontSize: 13, color: colors.textSecondary }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {icone && <Feather name={icone} size={13} color={colors.textMuted} />}
        <Text style={{ fontSize: 13, fontWeight: "500", color: colors.textPrimary }}>{valeur}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderWidth: 1, borderRadius: 12, padding: 16 },
  ligne: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  boutonAction: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 8 },
});