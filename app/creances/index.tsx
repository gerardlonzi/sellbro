import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Linking, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { supabase } from "@/lib/supabase/client";
import { BoutonPrimaire, EnteteEcran } from "@/components/UI";
import { PanneauFiltre } from "@/components/PanneauFiltre";
import { ValeursFiltre, VALEURS_FILTRE_VIDES } from "@/lib/filtres/types";
import { dansPlageMontant } from "@/lib/filtres/appliquerFiltres";
import { MenuContextuel } from "@/components/MenuContextuel";


type CreanceDette = {
  id: string; type: "creance" | "dette"; personne_nom: string; telephone: string | null;
  montant_restant: number; date_echeance: string | null; statut: string;
};

export default function CreancesDettes() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { formater } = useCurrency();
  const [onglet, setOnglet] = useState<"creance" | "dette">("creance");
  const [liste, setListe] = useState<CreanceDette[]>([]);
  const [chargement, setChargement] = useState(true);
  const [filtres, setFiltres] = useState<ValeursFiltre>(VALEURS_FILTRE_VIDES);
  const [panneauOuvert, setPanneauOuvert] = useState(false);

  useEffect(() => {
    chargerListe();
  }, [onglet]);

  async function chargerListe() {
    setChargement(true);
    const { data } = await supabase.from("creances_dettes").select("*").eq("type", onglet).order("date_echeance", { ascending: true });
    setListe(data ?? []);
    setChargement(false);
  }

  function estEnRetard(c: CreanceDette) {
    return !!c.date_echeance && new Date(c.date_echeance) < new Date() && c.statut !== "payee";
  }

  function estAVenir(c: CreanceDette) {
    if (!c.date_echeance || c.statut === "payee") return false;
    const dansSeptJours = new Date();
    dansSeptJours.setDate(dansSeptJours.getDate() + 7);
    return new Date(c.date_echeance) >= new Date() && new Date(c.date_echeance) <= dansSeptJours;
  }

  let filtrees = liste.filter((c) => {
    if (filtres.statut === "retard") return estEnRetard(c);
    if (filtres.statut === "payees") return c.statut === "payee";
    if (filtres.statut === "a_venir") return estAVenir(c);
    return true;
  });
  filtrees = filtrees.filter((c) => dansPlageMontant(c.montant_restant, filtres));

  if (filtres.tri === "montant_croissant") filtrees = [...filtrees].sort((a, b) => a.montant_restant - b.montant_restant);
  if (filtres.tri === "montant_decroissant") filtrees = [...filtrees].sort((a, b) => b.montant_restant - a.montant_restant);
  if (filtres.tri === "echeance_proche") {
    filtrees = [...filtrees].sort((a, b) => {
      if (!a.date_echeance) return 1;
      if (!b.date_echeance) return -1;
      return +new Date(a.date_echeance) - +new Date(b.date_echeance);
    });
  }

  const filtreActif = filtres.tri !== "" || filtres.statut !== "tous" || filtres.montantMin !== "" || filtres.montantMax !== "";

  function appeler(telephone: string | null) {
    if (telephone) Linking.openURL(`tel:${telephone}`);
  }

  function envoyerWhatsapp(telephone: string | null, nom: string, montant: number) {
    if (!telephone) return;
    const message = `Bonjour ${nom}, petit rappel : vous avez un solde de ${montant} FCFA. Merci de régulariser quand vous pourrez.`;
    Linking.openURL(`https://wa.me/${telephone.replace("+", "")}?text=${encodeURIComponent(message)}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <EnteteEcran titre={t("creances_titre", langue)} onRetour={() => router.back()} />

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
        <View style={[styles.onglets, { backgroundColor: colors.surface, flex: 1 }]}>
          <Pressable onPress={() => setOnglet("creance")} style={[styles.onglet, onglet === "creance" && { backgroundColor: colors.background }]}>
            <Text style={{ fontSize: 12, color: colors.textPrimary, fontWeight: onglet === "creance" ? "500" : "400" }}>{t("creances_on_te_doit", langue)}</Text>
          </Pressable>
          <Pressable onPress={() => setOnglet("dette")} style={[styles.onglet, onglet === "dette" && { backgroundColor: colors.background }]}>
            <Text style={{ fontSize: 12, color: colors.textPrimary, fontWeight: onglet === "dette" ? "500" : "400" }}>{t("creances_tu_dois", langue)}</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => setPanneauOuvert(true)} style={[styles.boutonFiltreIcone, { borderColor: filtreActif ? colors.accent : colors.border, borderWidth: filtreActif ? 1.5 : 1 }]}>
          <Feather name="sliders" size={16} color={filtreActif ? colors.accent : colors.textSecondary} />
        </Pressable>
      </View>

      {chargement ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : filtrees.length === 0 ? (
        <View style={styles.vide}>
          <Feather name="inbox" size={30} color={colors.textMuted} style={{ marginBottom: 10 }} />
          <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center" }}>
            {onglet === "creance" ? t("creances_vide_texte_creance", langue) : t("creances_vide_texte_dette", langue)}
          </Text>
        </View>
      ) : (
        <ScrollView>
          {filtrees.map((c) => {
            const enRetard = estEnRetard(c);
            return (
              <View key={c.id} style={[styles.carteCreance, { backgroundColor: enRetard ? colors.dangerBg : colors.surface }]}>
                <View style={styles.ligneHaut}>
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{c.personne_nom}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{formater(c.montant_restant)}</Text>
                    <MenuContextuel
                      actions={[
                        { label: "Marquer payée", icone: "check-circle", onPress: async () => { await supabase.from("creances_dettes").update({ statut: "payee" }).eq("id", c.id); chargerListe(); } },
                        { label: t("categories_supprimer_confirmer", langue), icone: "trash-2", destructif: true, onPress: async () => { await supabase.from("creances_dettes").delete().eq("id", c.id); chargerListe(); } },
                      ]}
                    />
                  </View>
                </View>
                <Text style={{ color: enRetard ? colors.danger : colors.textMuted, fontSize: 11, marginBottom: 8 }}>
                  {c.statut === "payee" ? t("creances_payee", langue) : enRetard ? t("creances_en_retard", langue) : ""}
                </Text>
                <View style={styles.ligneActions}>
                  <Pressable onPress={() => appeler(c.telephone)} style={[styles.boutonAction, { borderColor: colors.border, borderWidth: 1 }]}>
                    <Feather name="phone" size={13} color={colors.textPrimary} />
                  </Pressable>
                  <Pressable onPress={() => envoyerWhatsapp(c.telephone, c.personne_nom, c.montant_restant)} style={[styles.boutonAction, { backgroundColor: "#1D9E75" }]}>
                    <Feather name="message-circle" size={13} color="#fff" />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <BoutonPrimaire texte={`+ ${t("creances_ajouter", langue)}`} onPress={() => router.push({ pathname: "/creances/nouvelle", params: { type: onglet } })} />

      <PanneauFiltre
        visible={panneauOuvert}
        onFermer={() => setPanneauOuvert(false)}
        valeurs={filtres}
        onAppliquer={setFiltres}
        config={{
          tri: [
            { valeur: "montant_croissant", labelCle: "tri_montant_croissant" },
            { valeur: "montant_decroissant", labelCle: "tri_montant_decroissant" },
            { valeur: "echeance_proche", labelCle: "tri_echeance_proche" },
          ],
          statut: [
            { valeur: "tous", labelCle: "creances_filtre_tous" },
            { valeur: "retard", labelCle: "creances_filtre_retard" },
            { valeur: "payees", labelCle: "creances_filtre_payees" },
            { valeur: "a_venir", labelCle: "creances_statut_a_venir" },
          ],
          avecMontant: true,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  onglets: { flexDirection: "row", borderRadius: 10, padding: 3 },
  onglet: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  boutonFiltreIcone: { width: 42, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  vide: { alignItems: "center", paddingTop: 50, flex: 1 },
  carteCreance: { borderRadius: 14, padding: 14, marginBottom: 10 },
  ligneHaut: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  ligneActions: { flexDirection: "row", gap: 6 },
  boutonAction: { width: 36, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 8 },
});