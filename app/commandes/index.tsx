import { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { supabase } from "@/lib/supabase/client";
import { EnteteEcran } from "@/components/UI";
import { PanneauFiltre } from "@/components/PanneauFiltre";
import { ValeursFiltre, VALEURS_FILTRE_VIDES } from "@/lib/filtres/types";
import { dansPeriode, dansPlageMontant } from "@/lib/filtres/appliquerFiltres";
import { usePlanActuel } from "@/lib/plan/usePlanActuel";
import { MenuContextuel } from "@/components/MenuContextuel";
import { BoutonFlottant } from "@/components/BoutonFlottant";


type Vente = {
  id: string; quantite: number; prix_unitaire: number; client_nom: string | null;
  source: string; mode_paiement: string | null; created_at: string;
};
const ICONES_SOURCE: Record<string, any> = { vocal: "mic", scan: "camera", manuel: "edit-3" };

export default function Commandes() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { formater } = useCurrency();
  const [recherche, setRecherche] = useState("");
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [chargement, setChargement] = useState(true);
  const [filtres, setFiltres] = useState<ValeursFiltre>(VALEURS_FILTRE_VIDES);
  const [panneauOuvert, setPanneauOuvert] = useState(false);
  const { plan } = usePlanActuel();

  useEffect(() => {
    chargerVentes();
  }, []);

  async function chargerVentes() {
    setChargement(true);
    let requete = supabase.from("ventes").select("*").order("created_at", { ascending: false });
  
    if (plan?.historiqueJours) {
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - plan.historiqueJours);
      requete = requete.gte("created_at", dateLimit.toISOString());
    }
  
    const { data } = await requete;
    setVentes(data ?? []);
    setChargement(false);
  }

  let filtrees = ventes
    .filter((v) => (v.client_nom ?? "").toLowerCase().includes(recherche.toLowerCase()))
    .filter((v) => filtres.statut === "tous" || v.source === filtres.statut)
    .filter((v) => filtres.paiement === "tous" || v.mode_paiement === filtres.paiement)
    .filter((v) => dansPeriode(v.created_at, filtres))
    .filter((v) => dansPlageMontant(v.quantite * v.prix_unitaire, filtres));

  if (filtres.tri === "date_recente") filtrees = [...filtrees].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  if (filtres.tri === "date_ancienne") filtrees = [...filtrees].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  if (filtres.tri === "montant_croissant") filtrees = [...filtrees].sort((a, b) => a.quantite * a.prix_unitaire - b.quantite * b.prix_unitaire);
  if (filtres.tri === "montant_decroissant") filtrees = [...filtrees].sort((a, b) => b.quantite * b.prix_unitaire - a.quantite * a.prix_unitaire);

  const total = filtrees.reduce((s, v) => s + v.quantite * v.prix_unitaire, 0);
  const filtreActif = filtres.tri !== "" || filtres.statut !== "tous" || filtres.paiement !== "tous" || filtres.periode !== "tous" || filtres.montantMin !== "" || filtres.montantMax !== "";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
<View style={styles.entete}>
  <EnteteEcran titre={t("commandes_titre", langue)} onRetour={() => router.back()} />
 
</View>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <TextInput
          placeholder={t("commandes_recherche", langue)}
          placeholderTextColor={colors.textMuted}
          value={recherche}
          onChangeText={setRecherche}
          style={[styles.recherche, { borderColor: colors.border, color: colors.textPrimary, flex: 1 }]}
        />
        <Pressable onPress={() => setPanneauOuvert(true)} style={[styles.boutonFiltreIcone, { borderColor: filtreActif ? colors.accent : colors.border, borderWidth: filtreActif ? 1.5 : 1 }]}>
          <Feather name="sliders" size={16} color={filtreActif ? colors.accent : colors.textSecondary} />
        </Pressable>
      </View>

      {!chargement && filtrees.length > 0 && (
        <View style={[styles.bandeauTotal, { backgroundColor: colors.accentBg }]}>
          <Text style={{ color: colors.accent, fontSize: 12 }}>{t("commandes_total", langue)} : {formater(total)} ({filtrees.length})</Text>
        </View>
      )}

      {chargement ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : filtrees.length === 0 ? (
        <View style={styles.etatVide}>
          <Feather name="shopping-bag" size={30} color={colors.textMuted} style={{ marginBottom: 10 }} />
          <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center" }}>{t("commandes_vide", langue)}</Text>
        </View>
      ) : (
        <ScrollView>
          {filtrees.map((v) => (
            <View key={v.id} style={[styles.ligne, { borderBottomColor: colors.border }]}>
            <Pressable style={styles.ligneGauche} onPress={() => router.push(`/transaction/${v.id}`)}>
              <Feather name={ICONES_SOURCE[v.source] ?? "edit-3"} size={14} color={colors.textMuted} />
              <View>
                <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{v.client_nom ?? "—"}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>{new Date(v.created_at).toLocaleDateString(langue === "fr" ? "fr-FR" : "en-US")}</Text>
              </View>
            </Pressable>
            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500", marginRight: 10 }}>{formater(v.quantite * v.prix_unitaire)}</Text>
            <MenuContextuel
              actions={[
                { label: "Voir détail", icone: "eye", onPress: () => router.push(`/transaction/${v.id}`) },
                { label: t("categories_supprimer_confirmer", langue), icone: "trash-2", destructif: true, onPress: async () => { await supabase.from("ventes").delete().eq("id", v.id); chargerVentes(); } },
              ]}
            />
          </View>
          ))}
        </ScrollView>
      )}

      <PanneauFiltre
        visible={panneauOuvert}
        onFermer={() => setPanneauOuvert(false)}
        valeurs={filtres}
        onAppliquer={setFiltres}
        config={{
          tri: [
            { valeur: "date_recente", labelCle: "tri_date_recente" },
            { valeur: "date_ancienne", labelCle: "tri_date_ancienne" },
            { valeur: "montant_croissant", labelCle: "tri_montant_croissant" },
            { valeur: "montant_decroissant", labelCle: "tri_montant_decroissant" },
          ],
          statut: [
            { valeur: "tous", labelCle: "commandes_filtre_tous" },
            { valeur: "vocal", labelCle: "commandes_filtre_vocal" },
            { valeur: "scan", labelCle: "commandes_filtre_scan" },
            { valeur: "manuel", labelCle: "commandes_filtre_manuel" },
          ],
          paiement: [
            { valeur: "tous", labelCle: "commandes_paiement_tous" },
            { valeur: "cash", labelCle: "commandes_paiement_cash" },
            { valeur: "momo", labelCle: "commandes_paiement_momo" },
            { valeur: "credit", labelCle: "commandes_paiement_credit" },
          ],
          avecPeriode: true,
          avecMontant: true,
        }}
      />
     <BoutonFlottant onPress={() => router.push("/vente/nouvelle")} />

    </View>
  );
}

const styles = StyleSheet.create({
  recherche: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 },
  boutonFiltreIcone: { width: 42, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  bandeauTotal: { padding: 10, borderRadius: 10, marginBottom: 12 },
  etatVide: { alignItems: "center", paddingTop: 40 },
  ligne: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1 },
  ligneGauche: { flexDirection: "row", alignItems: "center", gap: 10 },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
   boutonAjoutPetit: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" }
});