import { useState } from "react";
import { ScrollView, StyleSheet, View, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Text } from "@/components/Texte";
import { EnteteEcran, BoutonPrimaire, Carte } from "@/components/UI";
import { Apparition } from "@/components/anim";
import { supabase } from "@/lib/supabase/client";
import { avecTimeout } from "@/lib/timeout";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { usePlanActuel } from "@/lib/plan/usePlanActuel";
import { useConnexion } from "@/lib/useConnexion";

type Ligne = { cle: string; ok: boolean; detail?: string };

// Diagnostic : vérifie en un geste les prérequis du scan / vocal IA côté serveur
// (clés des fournisseurs, tables, plan) et affiche la VRAIE cause d'un échec.
export default function Diagnostic() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { planId, verifie } = usePlanActuel();
  const enLigne = useConnexion();
  const [chargement, setChargement] = useState(false);
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function lancer() {
    setChargement(true);
    setErreur(null);
    setLignes(null);
    try {
      const { data, error } = await avecTimeout(
        supabase.functions.invoke("analyser-document", { body: { diagnostic: true } }),
        30000
      );
      if (error) {
        let detail = String((error as any)?.message ?? error);
        try {
          const corps = await (error as any)?.context?.json();
          if (corps?.error || corps?.erreur) detail = String(corps.error ?? corps.erreur);
        } catch {}
        // 404 = fonction non déployée ; sinon on affiche le code renvoyé.
        const statut = (error as any)?.context?.status;
        setErreur(statut === 404 ? t("diag_fonction_absente", langue) : `${t("diag_erreur_serveur", langue)} (${statut ?? "?"} · ${detail})`);
      } else {
        setLignes((data as any)?.diagnostic ?? []);
      }
    } catch (e: any) {
      setErreur(t("erreur_ia_hors_ligne", langue));
    } finally {
      setChargement(false);
    }
  }

  const locales: Ligne[] = [
    { cle: "connexion", ok: enLigne, detail: enLigne ? t("diag_en_ligne", langue) : t("diag_hors_ligne", langue) },
    { cle: "plan_app", ok: verifie, detail: `${t("diag_plan", langue)} : ${planId}${verifie ? "" : ` (${t("diag_non_verifie", langue)})`}` },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <EnteteEcran titre={t("diag_titre", langue)} onRetour={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Apparition>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 14 }}>{t("diag_intro", langue)}</Text>
        </Apparition>
        <Carte>
          {locales.map((l) => <LigneDiag key={l.cle} ligne={l} />)}
        </Carte>
        <View style={{ height: 14 }} />
        <BoutonPrimaire texte={chargement ? "…" : t("diag_lancer", langue)} onPress={lancer} disabled={chargement || !enLigne} icone="activity" />
        {chargement && <ActivityIndicator style={{ marginTop: 18 }} color={colors.accent} />}
        {erreur && (
          <Carte style={{ marginTop: 16, borderColor: colors.danger }}>
            <Text style={{ color: colors.danger, fontSize: 13, lineHeight: 19 }}>{erreur}</Text>
          </Carte>
        )}
        {lignes && (
          <Apparition>
            <Carte style={{ marginTop: 16 }}>
              {lignes.map((l) => <LigneDiag key={l.cle} ligne={l} />)}
            </Carte>
          </Apparition>
        )}
      </ScrollView>
    </View>
  );
}

function LigneDiag({ ligne }: { ligne: Ligne }) {
  const { colors } = useTheme();
  return (
    <View style={styles.ligne}>
      <Feather name={ligne.ok ? "check-circle" : "x-circle"} size={18} color={ligne.ok ? colors.success : colors.danger} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "700" }}>{ligne.cle}</Text>
        {ligne.detail ? <Text style={{ color: colors.textSecondary, fontSize: 12.5, marginTop: 2, lineHeight: 18 }}>{ligne.detail}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: "row", gap: 10, paddingVertical: 8 },
});
