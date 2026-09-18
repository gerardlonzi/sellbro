import { useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { database } from "@/lib/database";
import { obtenirUserId } from "@/lib/auth/userCache";
import { Q } from "@nozbe/watermelondb";
import { EnteteEcran } from "@/components/UI";
import { BoutonFlottant } from "@/components/BoutonFlottant";
import { libelleCategorieDepense } from "@/lib/depenses/categories";

type Depense = {
  id: string;
  categorie: string;
  description: string | null;
  montant: number;
  creeLe: Date;
  fournisseurNom: string | null;
  produitNom: string | null;
  champs: Record<string, string>;
};

const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MOIS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function Depenses() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { formater } = useCurrency();
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [chargement, setChargement] = useState(true);
  // Filtres : mois (null = tous), catégorie, fournisseur.
  const [mois, setMois] = useState<Date | null>(null);
  const [categorieFiltre, setCategorieFiltre] = useState<string | null>(null);
  const [fournisseurFiltre, setFournisseurFiltre] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [])
  );

  async function charger() {
    setChargement(true);
    const userId = await obtenirUserId();
    if (!userId) { setChargement(false); return; }
    const resultats = await database.get("depenses").query(Q.where("user_id", userId), Q.sortBy("cree_le", Q.desc)).fetch();
    setDepenses((resultats as any[]).map((d) => {
      let supp: any = {};
      try { supp = JSON.parse(d.donneesSupplementairesJson || "{}"); } catch {}
      return {
        id: d.id,
        categorie: d.categorie,
        description: d.description,
        montant: d.montant,
        creeLe: d.creeLe,
        fournisseurNom: supp.fournisseur_nom ?? null,
        produitNom: supp.produit_nom ?? null,
        champs: supp.champs ?? {},
      };
    }));
    setChargement(false);
  }

  // --- Filtres -------------------------------------------------------------
  const filtrees = depenses.filter((d) => {
    if (mois && (d.creeLe.getMonth() !== mois.getMonth() || d.creeLe.getFullYear() !== mois.getFullYear())) return false;
    if (categorieFiltre && d.categorie !== categorieFiltre) return false;
    if (fournisseurFiltre && d.fournisseurNom !== fournisseurFiltre) return false;
    return true;
  });

  // Catégories et fournisseurs présents dans les données (pour les puces).
  const categoriesPresentes = [...new Set(depenses.map((d) => d.categorie))];
  const fournisseursPresents = [...new Set(depenses.map((d) => d.fournisseurNom).filter(Boolean))] as string[];

  function changerMois(delta: number) {
    const base = mois ?? new Date();
    setMois(new Date(base.getFullYear(), base.getMonth() + delta, 1));
  }

  const nomsMois = langue === "en" ? MOIS_EN : MOIS_FR;
  const total = filtrees.reduce((s, d) => s + d.montant, 0);
  const filtreActif = mois !== null || categorieFiltre !== null || fournisseurFiltre !== null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <EnteteEcran titre={t("depenses_titre", langue)} onRetour={() => router.back()} />

      {/* Filtre par mois : navigation ‹ mois › */}
      <View style={styles.ligneFiltreMois}>
        <Pressable onPress={() => changerMois(-1)} hitSlop={10}>
          <Feather name="chevron-left" size={18} color={colors.textSecondary} />
        </Pressable>
        <Pressable onPress={() => setMois(null)}>
          <Text style={{ color: mois ? colors.accent : colors.textSecondary, fontSize: 13, fontWeight: "500" }}>
            {mois ? `${nomsMois[mois.getMonth()]} ${mois.getFullYear()}` : t("filtre_tous", langue)}
          </Text>
        </Pressable>
        <Pressable onPress={() => changerMois(1)} hitSlop={10}>
          <Feather name="chevron-right" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Filtre par catégorie */}
      {categoriesPresentes.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ligneFiltres}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <PuceFiltre label={t("filtre_tous", langue)} actif={categorieFiltre === null} onPress={() => setCategorieFiltre(null)} colors={colors} />
            {categoriesPresentes.map((c) => (
              <PuceFiltre key={c} label={libelleCategorieDepense(c, langue)} actif={categorieFiltre === c} onPress={() => setCategorieFiltre(categorieFiltre === c ? null : c)} colors={colors} />
            ))}
          </View>
        </ScrollView>
      )}

      {/* Filtre par fournisseur */}
      {fournisseursPresents.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ligneFiltres}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <PuceFiltre label={`${t("filtre_fournisseur", langue)} : ${t("filtre_tous", langue)}`} actif={fournisseurFiltre === null} onPress={() => setFournisseurFiltre(null)} colors={colors} />
            {fournisseursPresents.map((f) => (
              <PuceFiltre key={f} label={f} actif={fournisseurFiltre === f} onPress={() => setFournisseurFiltre(fournisseurFiltre === f ? null : f)} colors={colors} />
            ))}
          </View>
        </ScrollView>
      )}

      {!chargement && filtrees.length > 0 && (
        <View style={[styles.bandeauTotal, { backgroundColor: colors.dangerBg }]}>
          <Text style={{ color: colors.danger, fontSize: 12 }}>Total : {formater(total)} ({filtrees.length})</Text>
        </View>
      )}

      {chargement ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : filtrees.length === 0 ? (
        <View style={styles.etatVide}>
          <Feather name="credit-card" size={30} color={colors.textMuted} style={{ marginBottom: 10 }} />
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t("depenses_vide", langue)}</Text>
        </View>
      ) : (
        <ScrollView>
          {filtrees.map((d) => (
            <View key={d.id} style={[styles.ligne, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{libelleCategorieDepense(d.categorie, langue)}</Text>
                {d.description && <Text style={{ color: colors.textMuted, fontSize: 11 }}>{d.description}</Text>}
                {d.fournisseurNom && (
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    {t("filtre_fournisseur", langue)} : {d.fournisseurNom}
                  </Text>
                )}
                {d.produitNom && <Text style={{ color: colors.textMuted, fontSize: 11 }}>📦 {d.produitNom}</Text>}
                {Object.entries(d.champs).map(([nom, valeur]) => (
                  <Text key={nom} style={{ color: colors.textMuted, fontSize: 11 }}>{nom} : {valeur}</Text>
                ))}
                <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 2 }}>
                  {d.creeLe.toLocaleDateString(langue === "fr" ? "fr-FR" : "en-US")}
                </Text>
              </View>
              <Text style={{ color: colors.danger, fontSize: 13, fontWeight: "500" }}>{formater(d.montant)}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      <BoutonFlottant onPress={() => router.push("/depenses/nouvelle")} />
    </View>
  );
}

function PuceFiltre({ label, actif, onPress, colors }: any) {
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: actif ? 2 : 1, borderColor: actif ? colors.accent : colors.border }}>
      <Text style={{ fontSize: 11, color: actif ? colors.accent : colors.textSecondary }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ligneFiltreMois: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 8 },
  ligneFiltres: { marginBottom: 8 },
  bandeauTotal: { padding: 10, borderRadius: 10, marginBottom: 12 },
  etatVide: { alignItems: "center", paddingTop: 40 },
  ligne: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, gap: 10 },
});
