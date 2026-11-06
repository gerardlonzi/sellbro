import { useState, useCallback, useRef } from "react";
import { View, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { EtatVide, ListeSkeleton } from "@/components/EtatVide";
import { Apparition, PressableAnime } from "@/components/anim";
import { ombre } from "@/components/UI";
import { LinearGradient } from "expo-linear-gradient";
import { Text, TextInput } from "@/components/Texte";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { database } from "@/lib/database";
import { obtenirUserId } from "@/lib/auth/userCache";
import { Q } from "@nozbe/watermelondb";
import { MenuContextuel } from "@/components/MenuContextuel";
import { BoutonFlottant } from "@/components/BoutonFlottant";
import { AvatarNom } from "@/components/AvatarNom";
import { creerFactureDepuisVentes } from "@/lib/factures/creerFacture";
import { supprimerEnregistrement } from "@/lib/database/supprimer";
import { ouvrirOutilIA } from "@/lib/ia/ouvrirOutilIA";
import { useAccesIA } from "@/lib/ia/useAccesIA";
import { versionDonnees } from "@/lib/dataVersion";

type Vente = { id: string; quantite: number; prixUnitaire: number; produitNom: string | null; clientNom: string | null; source: string; creeLe: Date; imageUri: string | null };
const ICONES_SOURCE: Record<string, any> = { vocal: "mic", scan: "camera", manuel: "edit-3" };

export default function Ventes() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { showToast } = useToast();
  const { formaterCompact } = useCurrency();
  const { accesScan, accesVocal } = useAccesIA();
  const [recherche, setRecherche] = useState("");
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [chargement, setChargement] = useState(true);
  const [modeSelection, setModeSelection] = useState(false);
  const [selectionnees, setSelectionnees] = useState<Set<string>>(new Set());
  const [creationEnCours, setCreationEnCours] = useState(false);

  // Ne recharge la liste que si les données ont changé depuis la dernière
  // visite : ouvrir la page affichait un chargement à chaque fois, même sans
  // aucune modification. Même principe que Stock et Clients.
  const derniereVersion = useRef<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (derniereVersion.current === null || versionDonnees() !== derniereVersion.current) {
        derniereVersion.current = versionDonnees();
        charger();
      }
      // En quittant la page, on réinitialise le mode sélection (icône carrée)
      // pour ne pas rester « coincé » sur la sélection précédente au retour.
      return () => {
        setModeSelection(false);
        setSelectionnees(new Set());
      };
    }, [])
  );

  async function charger() {
    setChargement(true);
    const userId = await obtenirUserId();
    if (!userId) { setChargement(false); return; }

    const resultats = await database.get("ventes").query(Q.where("user_id", userId), Q.sortBy("cree_le", Q.desc)).fetch();

    // Image du produit vendu : jointure avec le catalogue (la vente ne stocke
    // que le nom). On reconstruit la même URI que la page Stock.
    const tousLesProduits = await database.get("produits").query(Q.where("user_id", userId)).fetch();
    const imageParId = new Map(
      (tousLesProduits as any[]).map((p) => {
        const supp = p.champsSupplementaires ?? {};
        let image: string | null = supp.image_uri ?? null;
        if (supp.images) {
          try { image = JSON.parse(supp.images)[0] ?? null; } catch {}
        }
        return [p.id, image] as const;
      })
    );

    setVentes((resultats as any[]).map((v) => ({
      id: v.id, quantite: v.quantite, prixUnitaire: v.prixUnitaire,
      produitNom: v.produitNom, clientNom: v.clientNom, source: v.source, creeLe: v.creeLe,
      imageUri: v.produitId ? imageParId.get(v.produitId) ?? null : null,
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
      showToast(t("ventes_erreur_facture_vide", langue), "error");
      return;
    }
    setCreationEnCours(true);
    const userId = await obtenirUserId();
    if (!userId) return;

    const factureId = await creerFactureDepuisVentes(userId, Array.from(selectionnees));
    setCreationEnCours(false);
    quitterModeSelection();
    router.push(`/factures/${factureId}`);
  }

  const filtrees = ventes.filter((v) =>
    (v.clientNom ?? "").toLowerCase().includes(recherche.toLowerCase()) ||
    (v.produitNom ?? "").toLowerCase().includes(recherche.toLowerCase())
  );
  const total = filtrees.reduce((s, v) => s + v.quantite * v.prixUnitaire, 0);

  // Regroupement par jour : « Aujourd'hui », « Hier », puis la date.
  const groupes: { cle: string; libelle: string; total: number; items: Vente[] }[] = [];
  {
    const auj = new Date(); auj.setHours(0, 0, 0, 0);
    const hier = new Date(auj); hier.setDate(hier.getDate() - 1);
    for (const v of filtrees) {
      const j = new Date(v.creeLe); j.setHours(0, 0, 0, 0);
      const cle = j.toISOString().slice(0, 10);
      let g = groupes.find((x) => x.cle === cle);
      if (!g) {
        const libelle = j.getTime() === auj.getTime() ? t("groupe_aujourdhui", langue)
          : j.getTime() === hier.getTime() ? t("groupe_hier", langue)
          : j.toLocaleDateString(langue === "fr" ? "fr-FR" : "en-US", { weekday: "long", day: "numeric", month: "long" });
        g = { cle, libelle, total: 0, items: [] };
        groupes.push(g);
      }
      g.items.push(v);
      g.total += v.quantite * v.prixUnitaire;
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <View style={styles.entete}>
      <View style={styles.enteteGauche}>
         <Pressable onPress={() => router.push("/reglages")} hitSlop={10}>
            <Feather name="menu" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>{t("tab_ventes", langue)}</Text>


        </View>
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
            <Feather
              name="square"
              size={17}
              color={colors.textSecondary}
            />
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
                backgroundColor: colors.surface,
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
        <Apparition>
          <LinearGradient colors={[colors.accentClair, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.resume}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" }}>{t("commandes_total", langue)}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 2 }}>{formaterCompact(total)}</Text>
            </View>
            <View style={styles.resumeNb}>
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>{filtrees.length}</Text>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 10.5 }}>{t("dash_unite_ventes", langue)}</Text>
            </View>
          </LinearGradient>
        </Apparition>
      )}

      {chargement ? (
        <ListeSkeleton />
      ) : filtrees.length === 0 ? (
        <EtatVide
          icone="shopping-bag"
          titre={t("commandes_vide", langue)}
          texte={t("vide_ventes_texte", langue)}
          actionLibelle={t("vide_action_vente", langue)}
          onAction={() => router.push("/vente/nouvelle")}
        />
      ) : (
        <ScrollView   contentContainerStyle={styles.contenu}
>
          {groupes.map((g, gi) => (
            <View key={g.cle}>
              <View style={styles.enteteGroupe}>
                <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", flex: 1 }}>{g.libelle}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700" }}>{formaterCompact(g.total)}</Text>
              </View>
              {g.items.map((v, i) => {
                const selectionnee = selectionnees.has(v.id);
                return (
                  <Apparition key={v.id} delai={Math.min(gi * 3 + i, 8) * 40} depuis={10}>
                    <PressableAnime
                      onPress={() => (modeSelection ? basculerSelection(v.id) : router.push(`/transaction/${v.id}`))}
                      echelle={0.98}
                      style={[styles.carteVente, { backgroundColor: colors.surface, borderColor: selectionnee ? colors.accent : colors.border }, ombre(colors, 1)]}
                    >
                      {modeSelection && (
                        <View style={[styles.checkbox, { borderColor: selectionnee ? colors.accent : colors.border, backgroundColor: selectionnee ? colors.accent : "transparent" }]}>
                          {selectionnee && <Feather name="check" size={12} color="#fff" />}
                        </View>
                      )}
                      <AvatarNom nom={v.produitNom ?? v.clientNom ?? "?"} imageUri={v.imageUri} taille={42} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "700" }}>
                          {v.produitNom ? `${v.produitNom} ×${v.quantite}` : v.clientNom ?? "—"}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
                          <View style={[styles.pastilleSource, { backgroundColor: colors.accentBg }]}>
                            <Feather name={ICONES_SOURCE[v.source] ?? "edit-3"} size={10} color={colors.accent} />
                          </View>
                          <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 11.5, flexShrink: 1 }}>
                            {v.clientNom ? `${v.clientNom} · ` : ""}{v.creeLe.toLocaleTimeString(langue === "fr" ? "fr-FR" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                          </Text>
                        </View>
                      </View>
                      <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "800" }}>
                        {formaterCompact(v.quantite * v.prixUnitaire)}
                      </Text>
                      {!modeSelection && (
                        <MenuContextuel actions={[{
                          label: t("categories_supprimer_confirmer", langue), icone: "trash-2", destructif: true,
                          onPress: async () => {
                            const enreg = await database.get("ventes").find(v.id);
                            await database.write(async () => { await supprimerEnregistrement("ventes", enreg as any); });
                            charger();
                          },
                        }]} />
                      )}
                    </PressableAnime>
                  </Apparition>
                );
              })}
            </View>
          ))}
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
        <BoutonFlottant
          actions={[
            { icone: "edit-3", libelle: t("fab_vente_manuelle", langue), onPress: () => router.push("/vente/nouvelle") },
            { icone: "mic", ia: "vocal", libelle: t("fab_vente_vocale", langue), verrouille: !accesVocal, onPress: () => ouvrirOutilIA("/vente/vocal", accesVocal, langue) },
            { icone: "camera", ia: "scan", libelle: t("fab_scanner_facture", langue), verrouille: !accesScan, onPress: () => ouvrirOutilIA("/scan-facture", accesScan, langue) },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  boutonEntete: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },


  recherche: {
    borderWidth: 1,
    borderRadius: 14,
    height: "100%",
    fontSize: 14,
    paddingLeft: 14,
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

  resume: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 20, marginBottom: 6 },
  resumeNb: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 },
  enteteGroupe: { flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 8, marginLeft: 2 },
  carteVente: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 18, borderWidth: 1, marginBottom: 8 },
  pastilleSource: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
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
  contenu: {  paddingBottom: 70 },
  enteteGauche: { flexDirection: "row", alignItems: "center", gap: 10 },


});