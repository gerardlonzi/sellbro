import { useState, useCallback } from "react";
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { useLangue, t } from "@/lib/i18n";
import { peutEcrire } from "@/lib/trial/gate";
import { afficherPaywall } from "@/lib/trial/paywall";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { obtenirUserId } from "@/lib/auth/userCache";
import { enregistrerActivite } from "@/lib/audit/journal";
import { supprimerEnregistrement } from "@/lib/database/supprimer";
import { EnteteEcran } from "@/components/UI";
import { PanneauFiltre } from "@/components/PanneauFiltre";
import { ValeursFiltre, VALEURS_FILTRE_VIDES } from "@/lib/filtres/types";
import { dansPeriode, dansPlageMontant } from "@/lib/filtres/appliquerFiltres";
import { MenuContextuel } from "@/components/MenuContextuel";
import { BoutonFlottant } from "@/components/BoutonFlottant";


type Vente = {
  id: string; quantite: number; prix_unitaire: number; client_nom: string | null;
  produit_nom: string | null;
  source: string; mode_paiement: string | null; created_at: string;
};
const ICONES_SOURCE: Record<string, any> = { vocal: "mic", scan: "camera", manuel: "edit-3" };

export default function Commandes() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { showToast } = useToast();
  const { formater } = useCurrency();
  const [recherche, setRecherche] = useState("");
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [filtres, setFiltres] = useState<ValeursFiltre>(VALEURS_FILTRE_VIDES);
  const [panneauOuvert, setPanneauOuvert] = useState(false);
  const { client } = useLocalSearchParams<{ client?: string }>();
  const [montantCreance, setMontantCreance] = useState(0);

  useFocusEffect(
    useCallback(() => {
      chargerVentes();
    }, [client])
  );

  async function chargerVentes() {
    setChargement(true);
    const userId = await obtenirUserId();
    if (!userId) { setChargement(false); return; }
    const resultats = await database.get("ventes").query(Q.where("user_id", userId), Q.sortBy("cree_le", Q.desc)).fetch();
    setVentes((resultats as any[]).map((v) => ({
      id: v.id, quantite: v.quantite, prix_unitaire: v.prixUnitaire, client_nom: v.clientNom,
      produit_nom: v.produitNom,
      source: v.source, mode_paiement: v.modePaiement,
      created_at: v.creeLe ? v.creeLe.toISOString() : new Date().toISOString(),
    })));

    if (client) {
      const creances = await database.get("creances_dettes").query(
        Q.where("user_id", userId),
        Q.where("type", "creance"),
        Q.where("personne_nom", client)
      ).fetch();
      setMontantCreance((creances as any[]).filter((c) => c.statut !== "payee").reduce((s, c) => s + c.montantRestant, 0));
    }
    setChargement(false);
  }

  let filtrees = ventes
    .filter((v) => !client || v.client_nom === client)
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
  <EnteteEcran titre={client ?? t("commandes_titre", langue)} onRetour={() => router.back()} />

</View>
      {client && (
        <View style={[styles.bandeauTotal, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Total : {formater(total)} · Bénéfice estimé : {formater(Math.round(total * 0.3))}</Text>
          {montantCreance > 0 && (
            <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>Crédit en cours : {formater(montantCreance)}</Text>
          )}
        </View>
      )}
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
                { label: t("categories_supprimer_confirmer", langue), icone: "trash-2", destructif: true, onPress: async () => { if (enregistrement) return; if (!(await peutEcrire())) { afficherPaywall(langue, () => router.push("/premium")); return; } setEnregistrement(true); try { const enreg = await database.get("ventes").find(v.id); await database.write(async () => { await supprimerEnregistrement("ventes", enreg as any); }); enregistrerActivite("vente", "suppression", `Vente supprimée : ${v.quantite} × ${v.produit_nom ?? "produit"}`); chargerVentes(); } finally { setEnregistrement(false); } } },
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