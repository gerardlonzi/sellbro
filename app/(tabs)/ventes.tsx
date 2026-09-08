import { useState, useCallback } from "react";
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { supabase } from "@/lib/supabase/client";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { MenuContextuel } from "@/components/MenuContextuel";
import { BoutonFlottant } from "@/components/BoutonFlottant";
import { creerFactureDepuisVentes } from "@/lib/factures/creerFacture";

type Vente = { id: string; quantite: number; prixUnitaire: number; produitNom: string | null; clientNom: string | null; source: string; creeLe: Date };
const ICONES_SOURCE: Record<string, any> = { vocal: "mic", scan: "camera", manuel: "edit-3" };

export default function Ventes() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { formater } = useCurrency();
  const [recherche, setRecherche] = useState("");
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [chargement, setChargement] = useState(true);
  const [modeSelection, setModeSelection] = useState(false);
  const [selectionnees, setSelectionnees] = useState<Set<string>>(new Set());
  const [creationEnCours, setCreationEnCours] = useState(false);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [])
  );

  async function charger() {
    setChargement(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setChargement(false); return; }

    const resultats = await database.get("ventes").query(Q.where("user_id", user.id), Q.sortBy("cree_le", Q.desc)).fetch();
    setVentes((resultats as any[]).map((v) => ({
      id: v.id, quantite: v.quantite, prixUnitaire: v.prixUnitaire,
      produitNom: v.produitNom, clientNom: v.clientNom, source: v.source, creeLe: v.creeLe,
    })));
    setChargement(false);
  }

  function basculerSelection(id: string) {
    setSelectionnees((actuel) => {
      const copie = new Set(actuel);
      if (copie.has(id)) copie.delete(id);
      else copie.add(id);
      return copie;
    });
  }

  function quitterModeSelection() {
    setModeSelection(false);
    setSelectionnees(new Set());
  }

  async function creerFacture() {
    if (selectionnees.size === 0) {
      Alert.alert("", t("ventes_erreur_facture_vide", langue));
      return;
    }
    setCreationEnCours(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const factureId = await creerFactureDepuisVentes(user.id, Array.from(selectionnees));
    setCreationEnCours(false);
    quitterModeSelection();
    router.push(`/factures/${factureId}`);
  }

  const filtrees = ventes.filter((v) => (v.clientNom ?? "").toLowerCase().includes(recherche.toLowerCase()));
  const total = filtrees.reduce((s, v) => s + v.quantite * v.prixUnitaire, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <View style={styles.entete}>
        <Text style={{ fontSize: 16, fontWeight: "500", color: colors.textPrimary }}>{t("tab_ventes", langue)}</Text>
        <View style={{flexDirection:"row", gap:3, alignItems:'center'}}>
        <Pressable
            onPress={() => setRechercheOuverte(true)}
            style={[
              styles.boutonEntete,
              { borderColor: colors.border },
            ]}
          >
            <Feather
              name="search"
              size={17}
              color={colors.textSecondary}
            />
          </Pressable>
        {modeSelection ? (
          <Pressable onPress={quitterModeSelection}>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t("ventes_selection_annuler", langue)}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setModeSelection(true)}>
            <Text style={{ color: colors.accent, fontSize: 13 }}>{t("ventes_selection_activer", langue)}</Text>
          </Pressable>
        )}
        </View>
      </View>
      {(rechercheOuverte && !modeSelection) && (
        <View style={styles.conteneurRecherche}>
          <TextInput
            autoFocus
            placeholder={t("commandes_recherche", langue)}
            placeholderTextColor={colors.textMuted}
            value={recherche}
            onChangeText={setRecherche}
            style={[
              styles.recherche,
              {
                borderColor: colors.border,
                color: colors.textPrimary,
                flex: 1,
                marginBottom: 0,
                paddingRight: 42,
              },
            ]}
          />

          {/* Bouton fermer */}
          <Pressable
            onPress={() => {
              setRecherche("");
              setRechercheOuverte(false);
            }}
            style={styles.boutonFermerRecherche}
          >
            <Feather
              name="x"
              size={17}
              color={colors.textSecondary}
            />
          </Pressable>
        </View>
      )}



      {!chargement && filtrees.length > 0 && !modeSelection && (
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
          {filtrees.map((v) => {
            const selectionnee = selectionnees.has(v.id);
            return (
              <Pressable
                key={v.id}
                onPress={() => (modeSelection ? basculerSelection(v.id) : router.push(`/transaction/${v.id}`))}
                style={[styles.ligne, { borderBottomColor: colors.border }]}
              >
                {modeSelection && (
                  <View style={[styles.checkbox, { borderColor: selectionnee ? colors.accent : colors.border, backgroundColor: selectionnee ? colors.accent : "transparent" }]}>
                    {selectionnee && <Feather name="check" size={12} color="#fff" />}
                  </View>
                )}
                <View style={styles.ligneGauche}>
                  <Feather name={ICONES_SOURCE[v.source] ?? "edit-3"} size={14} color={colors.textMuted} />
                  <View>
                    <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>
                      {v.produitNom ? `${v.produitNom} ×${v.quantite}` : v.clientNom ?? "—"}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                      {v.clientNom ? `${v.clientNom} · ` : ""}{v.creeLe.toLocaleDateString(langue === "fr" ? "fr-FR" : "en-US")}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500", marginRight: modeSelection ? 0 : 10 }}>
                  {formater(v.quantite * v.prixUnitaire)}
                </Text>
                {!modeSelection && (
                  <MenuContextuel actions={[{
                    label: t("categories_supprimer_confirmer", langue), icone: "trash-2", destructif: true,
                    onPress: async () => {
                      const enreg = await database.get("ventes").find(v.id);
                      await database.write(async () => { await (enreg as any).destroyPermanently(); });
                      charger();
                    },
                  }]} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {modeSelection ? (
        <Pressable
          onPress={creerFacture}
          disabled={creationEnCours}
          style={[styles.boutonFactureFlottant, { backgroundColor: colors.accent, opacity: creationEnCours ? 0.6 : 1 }]}
        >
          <Feather name="file-text" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>
            {creationEnCours ? "..." : `${t("ventes_creer_facture_bouton", langue)} (${t("ventes_selectionnees", langue)(selectionnees.size)})`}
          </Text>
        </Pressable>
      ) : (
        <BoutonFlottant onPress={() => router.push("/vente/nouvelle")} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  boutonEntete: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },


  recherche: {
    borderWidth: 1,
    borderRadius: 8,
    height: "100%",
    fontSize: 13,
  },

  conteneurRecherche: {
    position: "relative",
    marginBottom: 10,
    height: 40,
  },

  boutonFermerRecherche: {
    position: "absolute",
    right: 3,
    top: 0,
    bottom: 0,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  bandeauTotal: { padding: 10, borderRadius: 10, marginBottom: 12 },
  etatVide: { alignItems: "center", paddingTop: 40 },
  ligne: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1 },
  ligneGauche: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, alignItems: "center", justifyContent: "center", marginRight: 10 },
  boutonFactureFlottant: {
    position: "absolute", bottom: 24, left: 20, right: 20, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 12, elevation: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
  },
});