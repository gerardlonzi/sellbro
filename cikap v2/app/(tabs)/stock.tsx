
import { sauverPreference } from "@/lib/preferences/prefs";
import { useState, useCallback, useEffect, useRef } from "react";

import { View, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { EtatVide, ListeSkeleton } from "@/components/EtatVide";
import { Text, TextInput } from "@/components/Texte";

import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

import { useTheme } from "@/lib/theme/ThemeProvider";


import { useLangue, t } from "@/lib/i18n";
import { peutEcrire } from "@/lib/trial/gate";
import { afficherPaywall } from "@/lib/trial/paywall";

import { useCategories, CATEGORIES_PAR_DEFAUT } from "@/lib/categories/CategoriesProvider";

import { Badge, ombre } from "@/components/UI";
import { Apparition, PressableAnime } from "@/components/anim";
import { AvatarNom } from "@/components/AvatarNom";
import { ImageCachee } from "@/components/ImageCachee";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { PanneauFiltre } from "@/components/PanneauFiltre";

import {
  ValeursFiltre,
  VALEURS_FILTRE_VIDES,
} from "@/lib/filtres/types";

import { MenuContextuel } from "@/components/MenuContextuel";

import { BoutonFlottant } from "@/components/BoutonFlottant";

import { usePlanActuel } from "@/lib/plan/usePlanActuel";
import { useCurrency } from "@/lib/currency/CurrencyProvider";

import { database } from "@/lib/database";

import { Q } from "@nozbe/watermelondb";

import { obtenirUserId } from "@/lib/auth/userCache";
import { enregistrerActivite } from "@/lib/audit/journal";
import { supprimerEnregistrement } from "@/lib/database/supprimer";
import { versionDonnees } from "@/lib/dataVersion";

type Produit = {
  id: string;
  nom: string;
  prix_vente: number;
  quantite_stock: number;
  seuil_alerte: number;
  categorie_nom: string | null;
  nb_vendus: number;
  image_uri: string | null;
};

// Trois façons de voir le stock : « liste » (complète, une ligne par produit,
// le rendu historique), « grille » (grandes images, 2 colonnes, pour un
// catalogue visuel) et « minimal » (compact, le maximum de produits à l'écran).
// Le choix est mémorisé dans AsyncStorage : il survit à la fermeture de l'app.
type ModeAffichage = "liste" | "grille" | "minimal";
const CLE_MODE_AFFICHAGE = "stock_mode_affichage";
// Ordre de bascule à chaque appui sur le bouton de l'en-tête.
const ORDRE_MODES: ModeAffichage[] = ["liste", "grille", "minimal"];
const ICONES_MODES: Record<ModeAffichage, keyof typeof Feather.glyphMap> = {
  liste: "list",
  grille: "grid",
  minimal: "align-justify",
};
const CLES_MODES: Record<ModeAffichage, string> = {
  liste: "stock_affichage_liste",
  grille: "stock_affichage_grille",
  minimal: "stock_affichage_minimal",
};

export default function Stock() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { plan } = usePlanActuel();
  const { formater, formaterCompact } = useCurrency();
  const { categories } = useCategories();
  const { statut } = useLocalSearchParams<{ statut?: string }>();

  const [recherche, setRecherche] = useState("");
  const [rechercheOuverte, setRechercheOuverte] = useState(false);

  const [categorieFiltre, setCategorieFiltre] = useState<string | null>(
    null
  );

  const [produits, setProduits] = useState<Produit[]>([]);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);

  // ── Sélection multiple : appui long sur un produit → mode sélection ─────────
  const [selection, setSelection] = useState<string[]>([]);
  const modeSelection = selection.length > 0;
  function basculerSelection(id: string) {
    setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  function ouvrirOuSelectionner(p: Produit) {
    if (modeSelection) basculerSelection(p.id);
    else router.push(`/produit/${p.id}`);
  }
  async function supprimerSelection() {
    if (enregistrement || selection.length === 0) return;
    if (!(await peutEcrire())) { afficherPaywall(langue, () => router.push("/premium")); return; }
    Alert.alert(
      `${t("x_supprimer_selection", langue)} (${selection.length})`,
      t("x_supprimer_selection_confirm", langue),
      [
        { text: t("x_annuler_selection", langue), style: "cancel" },
        {
          text: t("categories_supprimer_confirmer", langue),
          style: "destructive",
          onPress: async () => {
            setEnregistrement(true);
            try {
              const ids = [...selection];
              await database.write(async () => {
                for (const id of ids) {
                  try {
                    const enreg = await database.get("produits").find(id);
                    await supprimerEnregistrement("produits", enreg as any);
                  } catch {}
                }
              });
              await enregistrerActivite("produit", "suppression", `${ids.length} produits supprimés`);
              setSelection([]);
              chargerProduits();
            } finally {
              setEnregistrement(false);
            }
          },
        },
      ]
    );
  }

  const [filtres, setFiltres] = useState<ValeursFiltre>(
    VALEURS_FILTRE_VIDES
  );

  const [panneauOuvert, setPanneauOuvert] = useState(false);

  const [modeAffichage, setModeAffichage] = useState<ModeAffichage>("liste");

  // Restaure le mode choisi au démarrage, comme le fait le thème.
  useEffect(() => {
    AsyncStorage.getItem(CLE_MODE_AFFICHAGE).then((sauvegarde) => {
      if (sauvegarde === "liste" || sauvegarde === "grille" || sauvegarde === "minimal") {
        setModeAffichage(sauvegarde);
      }
    });
  }, []);

  // Un appui sur l'en-tête fait tourner les trois modes dans l'ordre fixe.
  function basculerModeAffichage() {
    setModeAffichage((actuel) => {
      const prochain = ORDRE_MODES[(ORDRE_MODES.indexOf(actuel) + 1) % ORDRE_MODES.length];
      sauverPreference(CLE_MODE_AFFICHAGE, prochain).catch(() => {});
      return prochain;
    });
  }

  const derniereVersion = useRef<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (derniereVersion.current === null || versionDonnees() !== derniereVersion.current) {
        derniereVersion.current = versionDonnees();
        chargerProduits();
      }
      // En quittant la page, on réinitialise le filtre (ex: arrivée depuis
      // l'alerte « stock faible / rupture » du dashboard).
      return () => {
        setFiltres(VALEURS_FILTRE_VIDES);
      };
    }, [])
  );

  // Arrivée depuis une alerte du dashboard : on applique directement le filtre
  // pour n'afficher que les produits concernés (« rupture » ou « faible »).
  useEffect(() => {
    if (statut === "rupture" || statut === "faible") {
      setFiltres((f) => ({ ...f, statut }));
    }
  }, [statut]);

  async function chargerProduits() {
    setChargement(true);

    const userId = await obtenirUserId();

    if (!userId) {
      setChargement(false);
      return;
    }

    const resultats = await database
      .get("produits")
      .query(Q.where("user_id", userId))
      .fetch();

    // Nombre d'unités vendues par produit (colonne « vendue » de la liste).
    const ventes = await database
      .get("ventes")
      .query(Q.where("user_id", userId))
      .fetch();
    const vendusParProduit = new Map<string, number>();
    for (const v of ventes as any[]) {
      if (!v.produitId) continue;
      vendusParProduit.set(v.produitId, (vendusParProduit.get(v.produitId) ?? 0) + (v.quantite || 0));
    }

    setProduits(
      resultats.map((p: any) => ({
        id: p.id,
        nom: p.nom,
        prix_vente: p.prixVente,
        quantite_stock: p.quantiteStock,
        seuil_alerte: p.seuilAlerte,
        categorie_nom: p.categorieNom,
        nb_vendus: vendusParProduit.get(p.id) ?? 0,
        image_uri: p.champsSupplementaires?.images ? JSON.parse(p.champsSupplementaires.images)[0] ?? null : (p.champsSupplementaires?.image_uri ?? null),
      }))
    );

    setChargement(false);
  }

  let produitsFiltres = produits.filter(
    (p) =>
      p.nom.toLowerCase().includes(recherche.toLowerCase()) &&
      (!categorieFiltre || p.categorie_nom === categorieFiltre)
  );

  if (filtres.statut === "faible") {
    produitsFiltres = produitsFiltres.filter(
      (p) => p.quantite_stock <= p.seuil_alerte
    );
  }

  if (filtres.statut === "rupture") {
    produitsFiltres = produitsFiltres.filter(
      (p) => p.quantite_stock === 0
    );
  }

  if (filtres.tri === "nom_az") {
    produitsFiltres = [...produitsFiltres].sort((a, b) =>
      a.nom.localeCompare(b.nom)
    );
  }

  if (filtres.tri === "nom_za") {
    produitsFiltres = [...produitsFiltres].sort((a, b) =>
      b.nom.localeCompare(a.nom)
    );
  }

  if (filtres.tri === "stock_croissant") {
    produitsFiltres = [...produitsFiltres].sort(
      (a, b) => a.quantite_stock - b.quantite_stock
    );
  }

  if (filtres.tri === "stock_decroissant") {
    produitsFiltres = [...produitsFiltres].sort(
      (a, b) => b.quantite_stock - a.quantite_stock
    );
  }

  if (filtres.tri === "prix_croissant") {
    produitsFiltres = [...produitsFiltres].sort(
      (a, b) => a.prix_vente - b.prix_vente
    );
  }

  if (filtres.tri === "prix_decroissant") {
    produitsFiltres = [...produitsFiltres].sort(
      (a, b) => b.prix_vente - a.prix_vente
    );
  }

  const filtreActif =
    filtres.tri !== "" || filtres.statut !== "tous";

  // Actions du menu contextuel d'un produit — identiques dans les trois modes
  // d'affichage, d'où la factorisation.
  async function supprimerProduit(p: Produit) {
    if (enregistrement) return;
    if (!(await peutEcrire())) { afficherPaywall(langue, () => router.push("/premium")); return; }
    setEnregistrement(true);
    try {
      const enreg = await database.get("produits").find(p.id);
      await database.write(async () => {
        await supprimerEnregistrement("produits", enreg as any);
      });
      await enregistrerActivite("produit", "suppression", `Produit supprimé : ${p.nom}`);
      chargerProduits();
    } finally {
      setEnregistrement(false);
    }
  }

  function actionsProduit(p: Produit) {
    return [
      {
        label: t("stock_modifier", langue),
        icone: "edit-3" as const,
        onPress: () => router.push(`/produit/${p.id}`),
      },
      {
        label: t("categories_supprimer_confirmer", langue),
        icone: "trash-2" as const,
        destructif: true,
        onPress: () => supprimerProduit(p),
      },
    ];
  }

  // Indicateur de stock partagé par les modes liste et grille : pastille
  // colorée (rouge = rupture, orange = stock faible, vert = ok).
  function badgeStock(p: Produit) {
    const rupture = p.quantite_stock === 0;
    const faible = !rupture && p.quantite_stock <= p.seuil_alerte;
    const fond = rupture ? colors.dangerBg : faible ? colors.warningBg : colors.accentBg;
    const encre = rupture ? colors.danger : faible ? colors.warning : colors.accent;
    return (
      <View style={[styles.pastilleStock, { backgroundColor: fond }]}>
        <View style={[styles.pointStock, { backgroundColor: encre }]} />
        <Text numberOfLines={1} style={{ color: encre, fontSize: 12, fontWeight: "800" }}>{p.quantite_stock}</Text>
        <Text numberOfLines={1} style={{ color: encre, fontSize: 11, fontWeight: "600" }}>{t("stock_en_stock", langue)}</Text>
      </View>
    );
  }

  // Mode « liste » — carte par produit : image, nom + catégorie, prix, puis deux
  // colonnes ALIGNÉES côte à côte (stock | vendus), même hauteur, libellés discrets.
  function rendreLigneListe(p: Produit, i: number) {
    const rupture = p.quantite_stock === 0;
    const faible = !rupture && p.quantite_stock <= p.seuil_alerte;
    const fond = rupture ? colors.dangerBg : faible ? colors.warningBg : colors.accentBg;
    const encre = rupture ? colors.danger : faible ? colors.warning : colors.accent;
    return (
      <Apparition key={p.id} delai={Math.min(i, 8) * 35} depuis={10}>
        <PressableAnime
          onPress={() => ouvrirOuSelectionner(p)}
          onLongPress={() => basculerSelection(p.id)}
          delayLongPress={350}
          echelle={0.98}
          style={[styles.carteProduit, { backgroundColor: colors.surface, borderColor: selection.includes(p.id) ? colors.accent : colors.border, borderWidth: selection.includes(p.id) ? 2 : 1 }, ombre(colors, 1)]}
        >
          {modeSelection && (
            <Feather name={selection.includes(p.id) ? "check-circle" : "circle"} size={20} color={selection.includes(p.id) ? colors.accent : colors.textMuted} />
          )}
          <AvatarNom nom={p.nom} imageUri={p.image_uri} taille={46} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "700" }}>{p.nom}</Text>
            {p.categorie_nom ? (
              <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}>{p.categorie_nom}</Text>
            ) : null}
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: colors.accent, fontSize: 12.5, fontWeight: "800", marginTop: 3 }}>{formaterCompact(p.prix_vente)}</Text>
          </View>
          <View style={styles.colonneStats}>
            <View style={[styles.celluleStat, { backgroundColor: fond }]}>
              <Text numberOfLines={1} style={{ color: encre, fontSize: 15, fontWeight: "800" }}>{p.quantite_stock}</Text>
              <Text numberOfLines={1} style={{ color: encre, fontSize: 10, fontWeight: "600", marginTop: 1 }}>{t("stock_en_stock", langue)}</Text>
            </View>
            <View style={[styles.celluleStat, { backgroundColor: colors.background }]}>
              <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "800" }}>{p.nb_vendus}</Text>
              <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 10, fontWeight: "600", marginTop: 1 }}>{t("stock_vendus", langue)}</Text>
            </View>
          </View>
          {!modeSelection && <MenuContextuel actions={actionsProduit(p)} />}
        </PressableAnime>
      </Apparition>
    );
  }

  // Mode « grille » — grandes images, 2 colonnes, catalogue visuel.
  function rendreCarteGrille(p: Produit) {
    return (
      <View key={p.id} style={[styles.carteGrille, { backgroundColor: colors.surface, borderColor: selection.includes(p.id) ? colors.accent : colors.border, borderWidth: selection.includes(p.id) ? 2 : 1 }, ombre(colors, 1)]}>
        <Pressable onPress={() => ouvrirOuSelectionner(p)} onLongPress={() => basculerSelection(p.id)} delayLongPress={350}>
          {modeSelection && (
            <View style={{ position: "absolute", top: 6, right: 6, zIndex: 2 }}>
              <Feather name={selection.includes(p.id) ? "check-circle" : "circle"} size={22} color={selection.includes(p.id) ? colors.accent : "#fff"} />
            </View>
          )}
          {p.image_uri ? (
            <ImageCachee uri={p.image_uri} style={styles.imageGrille} />
          ) : (
            <View style={[styles.imageGrille, { backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" }]}>
              <AvatarNom nom={p.nom} taille={44} />
            </View>
          )}
        </Pressable>
        <View style={styles.corpsGrille}>
          <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 13.5, fontWeight: "700" }}>{p.nom}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
            <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: "800" }}>{formaterCompact(p.prix_vente)}</Text>
            {!modeSelection && <MenuContextuel actions={actionsProduit(p)} />}
          </View>
          <View style={{ marginTop: 6, alignSelf: "flex-start" }}>{badgeStock(p)}</View>
        </View>
      </View>
    );
  }

  // Mode « minimal » — compact : nom + prix + stock, le maximum de lignes.
  function rendreLigneMinimal(p: Produit) {
    return (
      <View key={p.id} style={[styles.ligneMinimal, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => ouvrirOuSelectionner(p)} onLongPress={() => basculerSelection(p.id)} delayLongPress={350} style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          {modeSelection && (
            <Feather name={selection.includes(p.id) ? "check-circle" : "circle"} size={18} color={selection.includes(p.id) ? colors.accent : colors.textMuted} />
          )}
          <AvatarNom nom={p.nom} imageUri={p.image_uri} taille={26} />
          <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 13, flexShrink: 1 }}>{p.nom}</Text>
        </Pressable>
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginRight: 8 }}>{formaterCompact(p.prix_vente)}</Text>
        <Text
          style={{
            fontSize: 12,
            fontWeight: "600",
            color: p.quantite_stock === 0 ? colors.danger : p.quantite_stock <= p.seuil_alerte ? colors.warning : colors.textPrimary,
          }}
        >
          {p.quantite_stock}
        </Text>
        {!modeSelection && <MenuContextuel actions={actionsProduit(p)} />}
      </View>
    );
  }

  // Grille en lignes de 2 explicites : flexWrap dans le contentContainer d'un
  // ScrollView n'affichait rien sur l'architecture legacy — avec des lignes
  // simples (flexDirection: "row"), le rendu est garanti.
  // Puces de catégories : celles ENREGISTRÉES par l'utilisateur (Réglages →
  // Catégories) + toute catégorie réellement portée par un de ses produits.
  const comptesCategories = new Map<string, number>();
  for (const p of produits) {
    if (p.categorie_nom) comptesCategories.set(p.categorie_nom, (comptesCategories.get(p.categorie_nom) ?? 0) + 1);
  }
  // Barre de filtre : uniquement les catégories de l'UTILISATEUR (celles qu'il a
  // créées + celles réellement utilisées par ses produits) — pas la liste par défaut.
  const categoriesUtilisateur = Array.from(new Set([
    ...categories.filter((c) => !CATEGORIES_PAR_DEFAUT.includes(c)),
    ...comptesCategories.keys(),
  ]));

  const pairesGrille: Produit[][] = [];
  if (modeAffichage === "grille") {
    for (let i = 0; i < produitsFiltres.length; i += 2) pairesGrille.push(produitsFiltres.slice(i, i + 2));
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: 14,
        paddingTop: 50,
      }}
    >
      {/* =========================
          ENTÊTE
      ========================== */}

      <View style={styles.entete}>
        <View style={styles.enteteGauche}>
         <Pressable onPress={() => router.push("/reglages")} hitSlop={10}>
            <Feather name="menu" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text
            style={{
              fontSize: 16, 
              fontWeight: "700",
              color: colors.textPrimary,
            }}
          >
            {t("stock_titre", langue)}
          </Text>

        </View>

        <View style={styles.actionsEntete}>
          {/* Bouton scan code-barres */}
          <Pressable
            onPress={() => router.push("/produit/scan")}
            style={[styles.boutonEntete, { borderColor: colors.border }]}
          >
            <MaterialCommunityIcons name="barcode-scan" size={17} color={colors.textSecondary} />
          </Pressable>

          {/* Bouton recherche */}
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

          {/* Bascule entre les modes d'affichage. L'icône montre le mode
              courant ; le libellé du mode est exposé pour l'accessibilité. */}
          <Pressable
            onPress={basculerModeAffichage}
            accessibilityLabel={t(CLES_MODES[modeAffichage] as any, langue) as string}
            style={[styles.boutonEntete, { borderColor: colors.border, borderWidth: 1 }]}
          >
            <Feather name={ICONES_MODES[modeAffichage]} size={16} color={colors.textSecondary} />
          </Pressable>

          {/* Bouton filtre */}
          <Pressable
            onPress={() => setPanneauOuvert(true)}
            style={styles.boutonFiltreIcone}
          >
            <Feather
              name="sliders"
              size={16}
              color={
                filtreActif
                  ? colors.accent
                  : colors.textSecondary
              }
            />
          </Pressable>

          {/* La liste de réapprovisionnement se partage depuis la page Dépenses. */}

          {/* Bouton export */}
          {plan?.exportComptable && (
            <Pressable
              onPress={() => router.push("/export")}
              style={[
                styles.boutonExport,
                { borderColor: colors.border },
              ]}
            >
              <Feather
                name="download"
                size={16}
                color={colors.textSecondary}
              />
            </Pressable>
          )}
        </View>
      </View>

      {/* =========================
          BARRE DE RECHERCHE
      ========================== */}

      {rechercheOuverte && (
        <View style={styles.conteneurRecherche}>
          <TextInput
            autoFocus
            placeholder={t("stock_recherche", langue)}
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

      {/* Résumé du catalogue : produits, stock faible, ruptures (touchables). */}
      {!chargement && produits.length > 0 && (
        <Apparition>
          <View style={styles.ligneResume}>
            {[
              { cle: "tous", valeur: produits.length, libelle: t("stock_nb_produits", langue), couleur: colors.accent, fond: colors.accentBg },
              { cle: "faible", valeur: produits.filter((p) => p.quantite_stock > 0 && p.quantite_stock <= p.seuil_alerte).length, libelle: t("stock_statut_faible", langue), couleur: colors.warning, fond: colors.warningBg },
              { cle: "rupture", valeur: produits.filter((p) => p.quantite_stock === 0).length, libelle: t("stock_statut_rupture", langue), couleur: colors.danger, fond: colors.dangerBg },
            ].map((r) => (
              <Pressable
                key={r.cle}
                onPress={() => setFiltres((f) => ({ ...f, statut: r.cle as any }))}
                style={({ pressed }) => [styles.tuileResume, { backgroundColor: r.fond, borderColor: filtres.statut === r.cle ? r.couleur : "transparent", opacity: pressed ? 0.85 : 1 }]}
              >
                <Text numberOfLines={1} style={{ color: r.couleur, fontSize: 20, fontWeight: "800" }}>{r.valeur}</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ color: r.couleur, fontSize: 11.5, fontWeight: "700", marginTop: 2 }}>{r.libelle}</Text>
              </Pressable>
            ))}
          </View>
        </Apparition>
      )}

      {/* =========================
          FILTRE PAR CATÉGORIE
      ========================== */}

      {categoriesUtilisateur.length > 0 && (
        <View style={{ marginBottom: 12, height: 40 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={styles.barreCategories}
          >
            {[null, ...categoriesUtilisateur].map((c) => {
              const actif = (c ?? null) === (categorieFiltre ?? null);
              return (
                <Pressable
                  key={c ?? "__tous"}
                  onPress={() => setCategorieFiltre(c)}
                  style={({ pressed }) => [
                    styles.puceCategorie,
                    {
                      borderColor: actif ? colors.accent : colors.border,
                      backgroundColor: actif ? colors.accent : colors.surface,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text numberOfLines={1} style={{ color: actif ? "#fff" : colors.textSecondary, fontSize: 13, fontWeight: "700" }}>
                    {c ?? t("stock_tous", langue)}
                  </Text>
                  {c !== null && (
                    <View style={[styles.compteCategorie, { backgroundColor: actif ? "rgba(255,255,255,0.25)" : colors.accentBg }]}>
                      <Text style={{ color: actif ? "#fff" : colors.accent, fontSize: 10.5, fontWeight: "800" }}>{comptesCategories.get(c) ?? 0}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* =========================
          CONTENU
      ========================== */}

      {chargement ? (
        <ListeSkeleton />
      ) : produitsFiltres.length === 0 ? (
        <EtatVide
          icone="package"
          titre={produits.length === 0 ? t("stock_vide_titre", langue) : t("stock_aucun_resultat", langue)}
          texte={produits.length === 0 ? t("stock_vide_texte", langue) : undefined}
          actionLibelle={produits.length === 0 ? t("vide_action_produit", langue) : undefined}
          onAction={produits.length === 0 ? () => router.push("/produit/nouveau") : undefined}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.contenu}>
          {modeAffichage === "grille"
            ? pairesGrille.map((paire, i) => (
                <View key={i} style={styles.rangGrille}>
                  {paire.map(rendreCarteGrille)}
                  {/* Cellule vide pour garder la colonne de droite alignée. */}
                  {paire.length === 1 && <View style={{ flex: 1 }} />}
                </View>
              ))
            : modeAffichage === "minimal"
              ? produitsFiltres.map(rendreLigneMinimal)
              : produitsFiltres.map((p, i) => rendreLigneListe(p, i))}
        </ScrollView>
      )}

      {/* =========================
          PANNEAU FILTRE
      ========================== */}

      <PanneauFiltre
        visible={panneauOuvert}
        onFermer={() => setPanneauOuvert(false)}
        valeurs={filtres}
        onAppliquer={setFiltres}
        config={{
          tri: [
            {
              valeur: "nom_az",
              labelCle: "tri_nom_az",
            },
            {
              valeur: "nom_za",
              labelCle: "tri_nom_za",
            },
            {
              valeur: "stock_croissant",
              labelCle: "tri_stock_croissant",
            },
            {
              valeur: "stock_decroissant",
              labelCle: "tri_stock_decroissant",
            },
            {
              valeur: "prix_croissant",
              labelCle: "tri_prix_croissant",
            },
            {
              valeur: "prix_decroissant",
              labelCle: "tri_prix_decroissant",
            },
          ],

          statut: [
            {
              valeur: "tous",
              labelCle: "stock_statut_tous",
            },
            {
              valeur: "faible",
              labelCle: "stock_statut_faible",
            },
            {
              valeur: "rupture",
              labelCle: "stock_statut_rupture",
            },
          ],
        }}
      />

      {/* =========================
          BOUTON FLOTTANT
      ========================== */}

      <BoutonFlottant
        onPress={() => router.push("/produit/nouveau")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  entete: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  actionsEntete: {
    flexDirection: "row",
    gap: 6,
  },

  boutonEntete: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  contenu: {  paddingBottom: 70 },


  boutonAjoutPetit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
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

  boutonFiltreIcone: {
    width: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },

  barreCategories: { alignItems: "center", paddingRight: 8, gap: 8, height: 40 },
  puceCategorie: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 36,
    flexShrink: 0,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  compteCategorie: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },

  etatVide: {
    alignItems: "center",
    paddingTop: 50,
  },

  ligneProduit: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },

  // Mode « grille » : lignes de 2 cartes (pas de flexWrap — voir le commentaire
  // au-dessus de pairesGrille).
  rangGrille: { flexDirection: "row", gap: 10, marginBottom: 10 },
  carteGrille: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    overflow: "hidden",
  },
  imageGrille: { width: "100%", aspectRatio: 1, resizeMode: "cover" },
  corpsGrille: { padding: 10 },

  // Mode « minimal » : lignes serrées, sans image de colonne dédiée au stock.
  ligneMinimal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
  },

  apercuImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },

  boutonExport: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  enteteGauche: { flexDirection: "row", alignItems: "center", gap: 10 },
  carteProduit: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 18, borderWidth: 1, marginBottom: 8 },
  colonneStats: { flexDirection: "row", alignItems: "stretch", gap: 6, flexShrink: 0 },
  celluleStat: { minWidth: 50, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12 },
  pastilleStock: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  pointStock: { width: 6, height: 6, borderRadius: 3 },
  ligneResume: { flexDirection: "row", gap: 8, marginBottom: 12 },
  tuileResume: { flex: 1, minHeight: 62, justifyContent: "center", borderRadius: 16, borderWidth: 1.5, paddingVertical: 10, paddingHorizontal: 12 },
});

