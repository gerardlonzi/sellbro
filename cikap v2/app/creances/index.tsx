import { useState, useCallback } from "react";
import { View, ScrollView, Pressable, StyleSheet, Linking, ActivityIndicator } from "react-native";
import { EtatVide, ListeSkeleton } from "@/components/EtatVide";
import { Text, TextInput } from "@/components/Texte";
import { router, useFocusEffect } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { obtenirUserId } from "@/lib/auth/userCache";
import { enregistrerActivite } from "@/lib/audit/journal";
import { peutEcrire } from "@/lib/trial/gate";
import { afficherPaywall } from "@/lib/trial/paywall";
import { formaterDate, parserDateSeule } from "@/lib/formatDate";
import { supprimerEnregistrement } from "@/lib/database/supprimer";
import { EnteteEcran, ombre } from "@/components/UI";
import { Apparition, PressableAnime } from "@/components/anim";
import { AvatarNom } from "@/components/AvatarNom";
import { LinearGradient } from "expo-linear-gradient";
import { PanneauFiltre } from "@/components/PanneauFiltre";
import { ValeursFiltre, VALEURS_FILTRE_VIDES } from "@/lib/filtres/types";
import { dansPlageMontant } from "@/lib/filtres/appliquerFiltres";
import { MenuContextuel } from "@/components/MenuContextuel";
import { BoutonFlottant } from "@/components/BoutonFlottant";



type CreanceDette = {
  id: string; type: "creance" | "dette"; personne_nom: string; telephone: string | null;
  montant_restant: number; date_echeance: string | null; statut: string;
  date_prise: string | null; produit_concerne: string | null;
};

export default function CreancesDettes() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { formaterCompact } = useCurrency();
  const [onglet, setOnglet] = useState<"creance" | "dette">("creance");
  const [liste, setListe] = useState<CreanceDette[]>([]);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [filtres, setFiltres] = useState<ValeursFiltre>(VALEURS_FILTRE_VIDES);
  const [panneauOuvert, setPanneauOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  // La barre de recherche est masquée par défaut : l'icône loupe (à gauche du
  // filtre) l'affiche/la cache comme un interrupteur.
  const [rechercheVisible, setRechercheVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      chargerListe();
    }, [onglet])
  );

  async function chargerListe() {
    setChargement(true);
    const userId = await obtenirUserId();
    if (!userId) { setChargement(false); return; }
    const resultats = await database.get("creances_dettes").query(
      Q.where("user_id", userId),
      Q.where("type", onglet),
      Q.sortBy("cree_le", Q.desc)
    ).fetch();
    setListe((resultats as any[]).map((c) => ({
      id: c.id, type: c.type, personne_nom: c.personneNom, telephone: c.telephone,
      montant_restant: c.montantRestant, date_echeance: c.dateEcheance, statut: c.statut,
      date_prise: c.creeLe ? c.creeLe.toISOString() : null,
      produit_concerne: c.produitConcerne ?? null,
    })));
    setChargement(false);
  }

  async function marquerPayee(id: string) {
    if (enregistrement) return;
    if (!(await peutEcrire())) { afficherPaywall(langue, () => router.push("/premium")); return; }
    setEnregistrement(true);
    try {
      const enreg = await database.get("creances_dettes").find(id);
      await database.write(async () => {
        // synchronise=false : sans ça, le push n'envoyait jamais le nouveau
        // statut et le PULL suivant réécrivait « en_retard » par-dessus.
        await (enreg as any).update((c: any) => { c.statut = "payee"; c.synchronise = false; });
      });
      await enregistrerActivite("creance", "modification", "Créance marquée payée");
      chargerListe();
    } finally {
      setEnregistrement(false);
    }
  }

  async function supprimerCreance(id: string) {
    if (enregistrement) return;
    if (!(await peutEcrire())) { afficherPaywall(langue, () => router.push("/premium")); return; }
    setEnregistrement(true);
    try {
      const enreg = await database.get("creances_dettes").find(id);
      await database.write(async () => {
        await supprimerEnregistrement("creances_dettes", enreg as any);
      });
      await enregistrerActivite("creance", "suppression", "Créance supprimée");
      chargerListe();
    } finally {
      setEnregistrement(false);
    }
  }

  function estEnRetard(c: CreanceDette) {
    return !!c.date_echeance && parserDateSeule(c.date_echeance) < new Date() && c.statut !== "payee";
  }

  function estAVenir(c: CreanceDette) {
    if (!c.date_echeance || c.statut === "payee") return false;
    const dansSeptJours = new Date();
    dansSeptJours.setDate(dansSeptJours.getDate() + 7);
    const echeance = parserDateSeule(c.date_echeance);
    return echeance >= new Date() && echeance <= dansSeptJours;
  }

  let filtrees = liste.filter((c) => {
    if (filtres.statut === "retard") return estEnRetard(c);
    if (filtres.statut === "payees") return c.statut === "payee";
    if (filtres.statut === "a_venir") return estAVenir(c);
    return true;
  });
  filtrees = filtrees.filter((c) => dansPlageMontant(c.montant_restant, filtres));

  // Recherche par nom de client (insensible à la casse).
  const terme = recherche.trim().toLowerCase();
  if (terme) filtrees = filtrees.filter((c) => c.personne_nom.toLowerCase().includes(terme));

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
    const message = t("creance_whatsapp_rappel", langue)(nom, formaterCompact(montant));
    Linking.openURL(`https://wa.me/${telephone.replace("+", "")}?text=${encodeURIComponent(message)}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50, height: "100%" }}>
      {/* Boutons recherche + filtre dans l'entête via la prop `action`
          (comme Dépenses/Fournisseurs) : un View externe à côté de
          EnteteEcran les poussait hors de l'écran à cause du titre en flex:1. */}
      <EnteteEcran
        titre={t("creances_titre", langue)}
        onRetour={() => router.back()}
        action={
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Pressable
              onPress={() => {
                // Bascule : fermer la barre efface aussi la recherche en cours.
                if (rechercheVisible) setRecherche("");
                setRechercheVisible(!rechercheVisible);
              }}
              style={styles.boutonFiltreIcone}
              hitSlop={8}
            >
              <Feather name="search" size={16} color={rechercheVisible || recherche ? colors.accent : colors.textSecondary} />
            </Pressable>
            <Pressable onPress={() => setPanneauOuvert(true)} style={styles.boutonFiltreIcone} hitSlop={8}>
              <Feather name="sliders" size={16} color={filtreActif ? colors.accent : colors.textSecondary} />
            </Pressable>
          </View>
        }
      />

      {rechercheVisible && (
        <View style={[styles.barreRecherche, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Feather name="search" size={14} color={colors.textMuted} />
          <TextInput
            value={recherche}
            onChangeText={setRecherche}
            placeholder={t("creances_rechercher", langue)}
            placeholderTextColor={colors.textMuted}
            autoFocus
            style={{ flex: 1, color: colors.textPrimary, fontSize: 13, paddingVertical: 8 }}
          />
          {recherche.length > 0 && (
            <Pressable onPress={() => setRecherche("")} hitSlop={8}>
              <Feather name="x" size={14} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      )}

      {/* Onglets : à recevoir / à payer */}
      <View style={[styles.onglets, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
        {(["creance", "dette"] as const).map((o) => (
          <Pressable key={o} onPress={() => setOnglet(o)} style={[styles.onglet, onglet === o && { backgroundColor: o === "creance" ? colors.accent : colors.danger }]}>
            <Feather name={o === "creance" ? "arrow-down-left" : "arrow-up-right"} size={14} color={onglet === o ? "#fff" : colors.textSecondary} />
            <Text style={{ fontSize: 13, color: onglet === o ? "#fff" : colors.textSecondary, fontWeight: onglet === o ? "700" : "500" }}>
              {t(o === "creance" ? "creances_on_te_doit" : "creances_tu_dois", langue)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Résumé : total restant, nombre de dossiers, retards */}
      {!chargement && liste.some((c) => c.statut !== "payee") && (
        <Apparition>
          <LinearGradient
            colors={onglet === "creance" ? [colors.accentClair, colors.accent] : ["#F2776B", "#D64545"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.resume}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" }}>
                {t(onglet === "creance" ? "creances_total_a_recevoir" : "creances_total_a_payer", langue)}
              </Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: "#fff", fontSize: 26, fontWeight: "800", marginTop: 2 }}>
                {formaterCompact(liste.filter((c) => c.statut !== "payee").reduce((a, c) => a + c.montant_restant, 0))}
              </Text>
            </View>
            <View style={{ gap: 6, alignItems: "flex-end" }}>
              <View style={styles.pastilleResume}>
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{liste.filter((c) => c.statut !== "payee").length} {t("creances_dossiers", langue)}</Text>
              </View>
              {liste.filter(estEnRetard).length > 0 && (
                <View style={[styles.pastilleResume, { backgroundColor: "rgba(0,0,0,0.28)" }]}>
                  <Feather name="alert-circle" size={11} color="#fff" />
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{liste.filter(estEnRetard).length} {t("creances_en_retard", langue).toString().toLowerCase()}</Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </Apparition>
      )}

      {chargement ? (
        <ListeSkeleton />
      ) : filtrees.length === 0 ? (
        <EtatVide
          icone={onglet === "creance" ? "arrow-down-left" : "arrow-up-right"}
          titre={onglet === "creance" ? t("vide_creances_titre_creance", langue) : t("vide_creances_titre_dette", langue)}
          texte={onglet === "creance" ? t("creances_vide_texte_creance", langue) : t("creances_vide_texte_dette", langue)}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.contenu}>
          {filtrees.map((c, i) => {
            const enRetard = estEnRetard(c);
            const payee = c.statut === "payee";
            const fmt = (d: string | null) => (d ? formaterDate(d, langue) : "—");
            const couleurStatut = payee ? colors.success : enRetard ? colors.danger : colors.warning;
            const fondStatut = payee ? colors.successBg : enRetard ? colors.dangerBg : colors.warningBg;
            return (
              <Apparition key={c.id} delai={Math.min(i, 8) * 40} depuis={10}>
                <View style={[styles.carteCreance, { backgroundColor: colors.surface, borderColor: enRetard ? colors.danger : colors.border }, ombre(colors, 1)]}>
                  <View style={[styles.barreStatut, { backgroundColor: couleurStatut }]} />
                  <PressableAnime onPress={() => router.push(`/creances/${c.id}`)} echelle={0.985}>
                    <View style={styles.ligneHaut}>
                      <AvatarNom nom={c.personne_nom} taille={42} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 14.5, fontWeight: "700" }}>{c.personne_nom}</Text>
                        {c.produit_concerne ? <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 11.5, marginTop: 2 }}>{c.produit_concerne}</Text> : null}
                      </View>
                      <Text numberOfLines={1} style={{ color: payee ? colors.success : colors.textPrimary, fontSize: 15, fontWeight: "800" }}>{formaterCompact(c.montant_restant)}</Text>
                    </View>
                    <View style={styles.ligneInfos}>
                      <View style={[styles.pastilleStatut, { backgroundColor: fondStatut }]}>
                        <Text style={{ color: couleurStatut, fontSize: 11, fontWeight: "800" }}>
                          {payee ? t("creances_payee", langue) : enRetard ? t("creances_en_retard", langue) : t("creances_statut_a_venir", langue)}
                        </Text>
                      </View>
                      <View style={styles.infoDate}>
                        <Feather name="calendar" size={11} color={colors.textMuted} />
                        <Text style={{ color: colors.textSecondary, fontSize: 11.5 }}>{fmt(c.date_echeance)}</Text>
                      </View>
                    </View>
                  </PressableAnime>
                  <View style={[styles.ligneActions, { borderTopColor: colors.border }]}>
                    <Text style={{ color: colors.textMuted, fontSize: 11, flex: 1 }}>{t("creance_date_prise", langue)} : {fmt(c.date_prise)}</Text>
                    <PressableAnime onPress={() => appeler(c.telephone)} style={[styles.boutonAction, { backgroundColor: colors.accentBg, opacity: c.telephone ? 1 : 0.4 }]}>
                      <Feather name="phone" size={14} color={colors.accent} />
                    </PressableAnime>
                    <PressableAnime onPress={() => envoyerWhatsapp(c.telephone, c.personne_nom, c.montant_restant)} style={[styles.boutonAction, { backgroundColor: "#1D9E75", opacity: c.telephone ? 1 : 0.4 }]}>
                      <MaterialCommunityIcons name="whatsapp" size={15} color="#fff" />
                    </PressableAnime>
                    <MenuContextuel
                      actions={[
                        ...(!payee ? [{ label: t("creance_marquer_payee", langue), icone: "check-circle" as const, onPress: async () => { await marquerPayee(c.id); } }] : []),
                        { label: t("categories_supprimer_confirmer", langue), icone: "trash-2" as const, destructif: true, onPress: async () => { await supprimerCreance(c.id); } },
                      ]}
                    />
                  </View>
                </View>
              </Apparition>
            );
          })}
        </ScrollView>
      )}

      <BoutonFlottant onPress={() => router.push("/creances/nouvelle")} />

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
  barreRecherche: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, marginBottom: 10 },
  onglets: { flexDirection: "row", borderRadius: 16, padding: 4, marginBottom: 12 },
  onglet: { flex: 1, flexDirection: "row", gap: 6, justifyContent: "center", paddingVertical: 10, borderRadius: 12, alignItems: "center" },
  boutonFiltreIcone: { width: 42, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  vide: { alignItems: "center", paddingTop: 50, flex: 1 },
  resume: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 20, marginBottom: 12 },
  pastilleResume: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.22)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  carteCreance: { borderRadius: 20, borderWidth: 1, padding: 14, paddingLeft: 18, marginBottom: 10, overflow: "hidden" },
  barreStatut: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  pastilleStatut: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  ligneHaut: { flexDirection: "row", alignItems: "center", gap: 12 },
  ligneInfos: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  infoDate: { flexDirection: "row", alignItems: "center", gap: 5 },
  ligneActions: { flexDirection: "row", gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, alignItems: "center" },
  boutonAction: { width: 38, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 11 },
  contenu: { paddingBottom: 90 },
});
