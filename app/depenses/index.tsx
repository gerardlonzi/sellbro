import { useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, TextInput, Share } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { database } from "@/lib/database";
import { obtenirUserId } from "@/lib/auth/userCache";
import { Q } from "@nozbe/watermelondb";
import { EnteteEcran } from "@/components/UI";
import { BoutonFlottant } from "@/components/BoutonFlottant";
import { useToast } from "@/lib/toast/ToastProvider";
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
  const { showToast } = useToast();
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [revenusMois, setRevenusMois] = useState(0);
  const [chargement, setChargement] = useState(true);
  // Filtres : mois (null = tous), jour précis (prioritaire), catégorie, fournisseur, recherche.
  const [mois, setMois] = useState<Date | null>(null);
  const [jour, setJour] = useState<Date | null>(null);
  const [categorieFiltre, setCategorieFiltre] = useState<string | null>(null);
  const [fournisseurFiltre, setFournisseurFiltre] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtresVisibles, setFiltresVisibles] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [])
  );

  // Liste de réapprovisionnement (ruptures + stock faible), partagée en texte
  // au fournisseur via la feuille système — WhatsApp, SMS, mail…
  const [nbACommander, setNbACommander] = useState(0);
  async function partagerReappro() {
    const userId = await obtenirUserId();
    if (!userId) return;
    const tous = await database.get("produits").query(Q.where("user_id", userId)).fetch();
    const aCommander = (tous as any[]).filter((p) => p.quantiteStock <= p.seuilAlerte);
    if (aCommander.length === 0) {
      showToast(t("reappro_aucun", langue), "info");
      return;
    }
    const lignes = aCommander
      .sort((a: any, b: any) => a.quantiteStock - b.quantiteStock)
      .map((p: any) => `• ${p.nom} — ${p.quantiteStock === 0 ? t("stock_statut_rupture", langue) : `${p.quantiteStock} ${t("stock_en_stock", langue)}`}`);
    await Share.share({ message: `${t("reappro_titre", langue)}\n\n${lignes.join("\n")}` }).catch(() => {});
  }

  async function charger() {
    setChargement(true);
    const userId = await obtenirUserId();
    if (!userId) { setChargement(false); return; }
    const resultats = await database.get("depenses").query(Q.where("user_id", userId), Q.sortBy("cree_le", Q.desc)).fetch();
    // Compte les produits à commander pour n'afficher le bouton que si besoin.
    const tous = await database.get("produits").query(Q.where("user_id", userId)).fetch();
    setNbACommander((tous as any[]).filter((p) => p.quantiteStock <= p.seuilAlerte).length);
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

  // Revenus du mois sélectionné (ou du mois courant si aucun filtre) :
  // somme des quantité × prix unitaire des ventes.
  async function chargerRevenus(moisCible: Date) {
    const userId = await obtenirUserId();
    if (!userId) return;
    const debut = new Date(moisCible.getFullYear(), moisCible.getMonth(), 1).getTime();
    const fin = new Date(moisCible.getFullYear(), moisCible.getMonth() + 1, 1).getTime();
    const ventes = await database.get("ventes").query(
      Q.where("user_id", userId),
      Q.where("cree_le", Q.gte(debut)),
      Q.where("cree_le", Q.lt(fin))
    ).fetch();
    const total = (ventes as any[]).reduce((s, v) => s + v.quantite * v.prixUnitaire, 0);
    setRevenusMois(total);
  }

  useFocusEffect(
    useCallback(() => {
      chargerRevenus(jour ?? mois ?? new Date());
    }, [jour, mois])
  );

  // --- Filtres -------------------------------------------------------------
  const texteRecherche = recherche.trim().toLowerCase();
  const filtrees = depenses.filter((d) => {
    if (jour) {
      if (d.creeLe.getDate() !== jour.getDate() || d.creeLe.getMonth() !== jour.getMonth() || d.creeLe.getFullYear() !== jour.getFullYear()) return false;
    } else if (mois && (d.creeLe.getMonth() !== mois.getMonth() || d.creeLe.getFullYear() !== mois.getFullYear())) {
      return false;
    }
    if (categorieFiltre && d.categorie !== categorieFiltre) return false;
    if (fournisseurFiltre && d.fournisseurNom !== fournisseurFiltre) return false;
    if (texteRecherche) {
      const contenu = [
        libelleCategorieDepense(d.categorie, langue),
        d.description ?? "",
        d.fournisseurNom ?? "",
        d.produitNom ?? "",
        ...Object.entries(d.champs).flat(),
      ].join(" ").toLowerCase();
      if (!contenu.includes(texteRecherche)) return false;
    }
    return true;
  });

  // Catégories et fournisseurs présents dans les données (pour les puces).
  const categoriesPresentes = [...new Set(depenses.map((d) => d.categorie))];
  const fournisseursPresents = [...new Set(depenses.map((d) => d.fournisseurNom).filter(Boolean))] as string[];

  function changerMois(delta: number) {
    const base = mois ?? new Date();
    setJour(null);
    setMois(new Date(base.getFullYear(), base.getMonth() + delta, 1));
  }

  const nomsMois = langue === "en" ? MOIS_EN : MOIS_FR;
  const total = filtrees.reduce((s, d) => s + d.montant, 0);
  const filtreActif = mois !== null || jour !== null || categorieFiltre !== null || fournisseurFiltre !== null || texteRecherche !== "";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <EnteteEcran
        titre={t("depenses_titre", langue)}
        onRetour={() => router.back()}
        action={
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {/* Partage de la liste de réapprovisionnement au fournisseur. */}
            {nbACommander > 0 && (
              <Pressable onPress={partagerReappro} style={styles.boutonFiltre} hitSlop={8} accessibilityLabel={t("reappro_titre", langue)}>
                <Feather name="truck" size={16} color={colors.textSecondary} />
              </Pressable>
            )}
            <Pressable
              onPress={() => setFiltresVisibles((v) => !v)}
              style={[styles.boutonFiltre, { borderColor: filtreActif ? colors.accent : colors.border, borderWidth: filtreActif ? 1.5 : 1 }]}
              hitSlop={8}
            >
              <Feather name="sliders" size={16} color={filtreActif ? colors.accent : colors.textSecondary} />
            </Pressable>
          </View>
        }
      />

      {/* Barre de recherche */}
      <View style={[styles.barreRecherche, { borderColor: colors.border }]}>
        <Feather name="search" size={14} color={colors.textMuted} />
        <TextInput
          value={recherche}
          onChangeText={setRecherche}
          placeholder={t("depenses_rechercher", langue)}
          placeholderTextColor={colors.textMuted}
          style={{ flex: 1, color: colors.textPrimary, fontSize: 13, paddingVertical: 0 }}
        />
        {recherche.length > 0 && (
          <Pressable onPress={() => setRecherche("")} hitSlop={8}>
            <Feather name="x" size={14} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {filtresVisibles && (
        <View>
          {/* Filtre par mois : navigation ‹ mois › + sélecteur de jour précis */}
          <View style={styles.ligneFiltreMois}>
            <Pressable onPress={() => changerMois(-1)} hitSlop={10}>
              <Feather name="chevron-left" size={18} color={colors.textSecondary} />
            </Pressable>
            <Pressable onPress={() => { setMois(null); setJour(null); }}>
              <Text style={{ color: mois || jour ? colors.accent : colors.textSecondary, fontSize: 13, fontWeight: "500" }}>
                {jour
                  ? jour.toLocaleDateString(langue === "fr" ? "fr-FR" : "en-US")
                  : mois
                    ? `${nomsMois[mois.getMonth()]} ${mois.getFullYear()}`
                    : t("filtre_tous", langue)}
              </Text>
            </Pressable>
            <Pressable onPress={() => changerMois(1)} hitSlop={10}>
              <Feather name="chevron-right" size={18} color={colors.textSecondary} />
            </Pressable>
            {/* Sélecteur de jour précis */}
            <Pressable onPress={() => setPickerVisible(true)} hitSlop={10} style={{ marginLeft: 4 }}>
              <Feather name="calendar" size={17} color={jour ? colors.accent : colors.textSecondary} />
            </Pressable>
          </View>

          {pickerVisible && (
            <DateTimePicker
              value={jour ?? mois ?? new Date()}
              mode="date"
              display="default"
              onChange={(_, date) => {
                setPickerVisible(false);
                if (date) setJour(date);
              }}
            />
          )}

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
        </View>
      )}

      {!chargement && filtrees.length > 0 && (
        <View style={[styles.bandeauTotal, { backgroundColor: colors.dangerBg }]}>
          <Text style={{ color: colors.danger, fontSize: 12 }}>Total : {formater(total)} ({filtrees.length})</Text>
          {/* Calcul intégré : revenus du mois − dépenses du mois (jour précis exclu) */}
          {!jour && (
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
              {t("depenses_revenus_mois", langue)} : {formater(revenusMois)}  •  {t("depenses_solde", langue)} : {formater(revenusMois - total)}
            </Text>
          )}
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
  boutonFiltre: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  barreRecherche: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 },
  ligneFiltreMois: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 8 },
  ligneFiltres: { marginBottom: 8 },
  bandeauTotal: { padding: 10, borderRadius: 10, marginBottom: 12 },
  etatVide: { alignItems: "center", paddingTop: 40 },
  ligne: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, gap: 10 },
});
