// Écran « Passer à Pro » — paiement via le CHECKOUT HÉBERGÉ SasPay.
//
// L'app ne collecte AUCUNE donnée de paiement (ni numéro Mobile Money, ni
// réseau) : l'utilisateur est renvoyé vers la page de paiement sécurisée
// SasPay (navigateur), qui gère le choix du réseau et la confirmation.
//
// Flux : bouton → create-saspay-checkout (Edge Function) → checkout_url
//        ouverte dans le navigateur → le statut arrive via Supabase Realtime
//        (payment_transactions, mis à jour par le webhook SasPay — seule
//        source de vérité). Au retour dans l'app, on propose une vérification
//        manuelle (verify-payment) si le webhook n'est pas encore arrivé.
import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase/client";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { useLangue, t } from "@/lib/i18n";
import { usePays } from "@/lib/pays/PaysProvider";
import { rafraichirPlan } from "@/lib/plan/planStore";
import { avecTimeout } from "@/lib/timeout";

type Etape = "pret" | "attente" | "succes" | "echec";

const TIMEOUT_ATTENTE_MS = 3 * 60 * 1000;

export default function Paiement() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { showToast } = useToast();
  const { pays } = usePays();

  const [etape, setEtape] = useState<Etape>("pret");
  const [chargement, setChargement] = useState(false);
  const [delaiDepasse, setDelaiDepasse] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reprise : si une transaction pending récente existe (app fermée pendant
  // le paiement), on reprend l'écoute au lieu de créer une nouvelle session.
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await avecTimeout(supabase.auth.getUser(), 5000);
        if (!user) return;

        const ilYa30Min = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const { data: enAttente } = await supabase
          .from("payment_transactions")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "pending")
          .gte("created_at", ilYa30Min)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (enAttente) {
          setTransactionId(enAttente.id);
          setEtape("attente");
          ecouter(enAttente.id);
        } else {
          // Pas d'écran intermédiaire : « Passer à Premium » ouvre
          // DIRECTEMENT le checkout SasPay (le message de redirection est
          // affiché sur la page Premium, avant le clic).
          payer();
        }
      } catch {
        // Hors ligne : l'écran reste utilisable.
      }
    })();
    return () => nettoyer();
  }, []);

  function nettoyer() {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  // Écoute Realtime du changement de statut de CETTE transaction.
  function ecouter(txId: string) {
    nettoyer();
    setDelaiDepasse(false);

    channelRef.current = supabase
      .channel(`paiement-${txId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "payment_transactions",
          filter: `id=eq.${txId}`,
        },
        (payload) => {
          const statut = (payload.new as { status?: string }).status;
          if (statut === "success") onSucces();
          else if (statut === "failed" || statut === "cancelled") onEchec();
        }
      )
      .subscribe();

    // Timeout de sécurité : après quelques minutes, on propose une
    // vérification manuelle (le webhook est peut-être en retard).
    timerRef.current = setTimeout(() => setDelaiDepasse(true), TIMEOUT_ATTENTE_MS);
  }

  async function onSucces() {
    nettoyer();
    // Passe en Premium (le webhook a mis à jour plan_utilisateur), puis
    // l'utilisateur est renvoyé vers l'app.
    await rafraichirPlan();
    setEtape("succes");
    setTimeout(() => router.replace("/(tabs)/accueil"), 2500);
  }

  function onEchec() {
    nettoyer();
    setEtape("echec");
  }

  // « Passer à Pro » : crée la session de checkout côté serveur puis ouvre
  // la page de paiement hébergée SasPay dans le navigateur.
  async function payer() {
    setChargement(true);
    try {
      const { data, error } = await avecTimeout(
        supabase.functions.invoke("create-saspay-checkout", {
          body: { country: pays.code },
        }),
        20000
      );
      if (error || !data?.checkout_url || !data?.transaction_id) {
        showToast(t("paiement_erreur_initiation", langue), "error");
        return;
      }

      setTransactionId(data.transaction_id);
      setEtape("attente");
      ecouter(data.transaction_id);

      // Ouvre le checkout SasPay. Sur paiement réussi, la page redirige vers
      // cikap://premium/retour ce qui ferme le navigateur automatiquement.
      await WebBrowser.openAuthSessionAsync(data.checkout_url, "cikap://premium/retour");

      // Retour dans l'app : le webhook a peut-être déjà confirmé — on force
      // une vérification immédiate (sinon le Realtime / le bouton prennent le relais).
      verifierSilencieux(data.transaction_id);
    } catch {
      showToast(t("connexion_requise", langue), "error");
    } finally {
      setChargement(false);
    }
  }

  // Vérification silencieuse au retour du navigateur (pas de toast si pending).
  async function verifierSilencieux(txId: string) {
    try {
      const { data } = await avecTimeout(
        supabase.functions.invoke("verify-payment", { body: { transaction_id: txId } }),
        20000
      );
      if (data?.status === "success") await onSucces();
      else if (data?.status === "failed" || data?.status === "cancelled") onEchec();
    } catch {
      // Hors ligne : le Realtime ou le bouton manuel feront foi.
    }
  }

  // Bouton « Vérifier le statut » : secours si le webhook n'est pas arrivé.
  async function verifier() {
    if (!transactionId) return;
    setChargement(true);
    try {
      const { data, error } = await avecTimeout(
        supabase.functions.invoke("verify-payment", { body: { transaction_id: transactionId } }),
        20000
      );
      if (error) {
        showToast(t("connexion_requise", langue), "error");
        return;
      }
      if (data?.status === "success") await onSucces();
      else if (data?.status === "failed" || data?.status === "cancelled") onEchec();
      else showToast(t("paiement_attente_texte", langue), "info");
    } catch {
      showToast(t("connexion_requise", langue), "error");
    } finally {
      setChargement(false);
    }
  }

  function reessayer() {
    nettoyer();
    setTransactionId(null);
    setEtape("pret");
  }

  // ---------- Rendu ----------

  if (etape === "succes") {
    return (
      <View style={[styles.centre, { backgroundColor: colors.background }]}>
        <Feather name="check-circle" size={56} color={colors.success} />
        <Text style={[styles.titre, { color: colors.textPrimary, marginTop: 16 }]}>{t("paiement_succes_titre", langue)}</Text>
        <Text style={[styles.texte, { color: colors.textSecondary }]}>{t("paiement_succes_texte", langue)}</Text>
        <Pressable onPress={() => router.replace("/(tabs)/accueil")} style={[styles.bouton, { backgroundColor: colors.accent, marginTop: 24 }]}>
          <Text style={styles.boutonTexte}>{t("bienvenue_essai_ok", langue)}</Text>
        </Pressable>
      </View>
    );
  }

  if (etape === "echec") {
    return (
      <View style={[styles.centre, { backgroundColor: colors.background }]}>
        <Feather name="x-circle" size={56} color={colors.danger} />
        <Text style={[styles.titre, { color: colors.textPrimary, marginTop: 16 }]}>{t("paiement_echec_titre", langue)}</Text>
        <Text style={[styles.texte, { color: colors.textSecondary }]}>{t("paiement_echec_texte", langue)}</Text>
        <Pressable onPress={reessayer} style={[styles.bouton, { backgroundColor: colors.accent, marginTop: 24 }]}>
          <Text style={styles.boutonTexte}>{t("paiement_reessayer", langue)}</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("otp_changer_email_annuler", langue)}</Text>
        </Pressable>
      </View>
    );
  }

  if (etape === "attente") {
    return (
      <View style={[styles.centre, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.titre, { color: colors.textPrimary, marginTop: 20 }]}>{t("paiement_attente_titre", langue)}</Text>
        <Text style={[styles.texte, { color: colors.textSecondary }]}>{t("paiement_attente_texte", langue)}</Text>
        {delaiDepasse && (
          <Pressable
            onPress={verifier}
            disabled={chargement}
            style={[styles.bouton, { backgroundColor: colors.accent, marginTop: 24, opacity: chargement ? 0.6 : 1 }]}
          >
            <Text style={styles.boutonTexte}>{chargement ? "..." : t("paiement_verifier", langue)}</Text>
          </Pressable>
        )}
        <Pressable onPress={reessayer} style={{ marginTop: 20 }}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("otp_changer_email_annuler", langue)}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.centre, { backgroundColor: colors.background }]}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.retour}>
        <Feather name="arrow-left" size={22} color={colors.textPrimary} />
      </Pressable>

      {/* Lancement automatique du checkout (déclenché au montage) : on montre
          un simple chargement. Si l'appel a échoué (hors ligne…), un bouton
          permet de réessayer. */}
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={[styles.titre, { color: colors.textPrimary, marginTop: 16 }]}>{t("paiement_titre", langue)}</Text>

      {!chargement && (
        <Pressable
          onPress={payer}
          style={[styles.bouton, { backgroundColor: colors.accent, marginTop: 28 }]}
        >
          <Text style={styles.boutonTexte}>{t("paiement_reessayer", langue)}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center" },
  retour: { position: "absolute", top: 50, left: 24, zIndex: 1 },
  titre: { fontSize: 18, fontWeight: "600", textAlign: "center", marginBottom: 6 },
  texte: { fontSize: 13, textAlign: "center", lineHeight: 20, marginTop: 8 },
  bouton: { paddingVertical: 14, borderRadius: 8, alignItems: "center", alignSelf: "stretch" },
  boutonTexte: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
