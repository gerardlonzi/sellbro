
import { useState, useCallback, useEffect, useRef } from "react";

import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";

import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

import { useTheme } from "@/lib/theme/ThemeProvider";


import { useLangue, t } from "@/lib/i18n";
import { peutEcrire } from "@/lib/trial/gate";
import { afficherPaywall } from "@/lib/trial/paywall";

import { useCategories } from "@/lib/categories/CategoriesProvider";

import { Badge } from "@/components/UI";
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
  const { formater } = useCurrency();
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
      AsyncStorage.setItem(CLE_MODE_AFFICHAGE, prochain).catch(() => {});
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
        label: t("produit_sauver", langue) === "Save" ? "Edit" : "Modifier",
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

  // Indicateur de stock partagé par les modes liste et grille.
  function badgeStock(p: Produit) {
    if (p.quantite_stock === 0) return <Badge texte={`${p.quantite_stock} ${t("stock_en_stock", langue)}`} type="danger" />;
    if (p.quantite_stock <= p.seuil_alerte) return <Badge texte={`${p.quantite_stock} ${t("stock_en_stock", langue)}`} type="attention" />;
    return <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{p.quantite_stock} {t("stock_en_stock", langue)}</Text>;
  }

  // Mode « liste » — le rendu historique, complet.
  function rendreLigneListe(p: Produit) {
    return (
      <View key={p.id} style={[styles.ligneProduit, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.push(`/produit/${p.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          <AvatarNom nom={p.nom} imageUri={p.image_uri} taille={36} />
          <View style={{ flexShrink: 1 }}>
            <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{p.nom}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{formater(p.prix_vente)}</Text>
          </View>
        </Pressable>

        <View style={{ width: 53, alignItems: "center", marginRight: 30, flexDirection: "row", gap: 4 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 10, fontWeight: "600" }}>{p.nb_vendus}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: "600" }}>{t("stock_vendus", langue)}</Text>
        </View>

        {badgeStock(p)}
        <MenuContextuel actions={actionsProduit(p)} />
      </View>
    );
  }

  // Mode « grille » — grandes images, 2 colonnes, catalogue visuel.
  function rendreCarteGrille(p: Produit) {
    return (
      <View key={p.id} style={[styles.carteGrille, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable onPress={() => router.push(`/produit/${p.id}`)}>
          {p.image_uri ? (
            <ImageCachee uri={p.image_uri} style={styles.imageGrille} />
          ) : (
            <View style={[styles.imageGrille, { backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" }]}>
              <AvatarNom nom={p.nom} taille={44} />
            </View>
          )}
        </Pressable>
        <View style={styles.corpsGrille}>
          <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{p.nom}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{formater(p.prix_vente)}</Text>
            <MenuContextuel actions={actionsProduit(p)} />
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
        <Pressable onPress={() => router.push(`/produit/${p.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          <AvatarNom nom={p.nom} imageUri={p.image_uri} taille={26} />
          <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 13, flexShrink: 1 }}>{p.nom}</Text>
        </Pressable>
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginRight: 8 }}>{formater(p.prix_vente)}</Text>
        <Text
          style={{
            fontSize: 12,
            fontWeight: "600",
            color: p.quantite_stock === 0 ? colors.danger : p.quantite_stock <= p.seuil_alerte ? colors.warning : colors.textPrimary,
          }}
        >
          {p.quantite_stock}
        </Text>
        <MenuContextuel actions={actionsProduit(p)} />
      </View>
    );
  }

  // Grille en lignes de 2 explicites : flexWrap dans le contentContainer d'un
  // ScrollView n'affichait rien sur l'architecture legacy — avec des lignes
  // simples (flexDirection: "row"), le rendu est garanti.
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
              fontWeight: "500",
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

      {/* =========================
          FILTRE PAR CATÉGORIE
      ========================== */}

      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{
            marginBottom: 12,
            maxHeight: 30,
          }}
        >
          <Pressable
            onPress={() => setCategorieFiltre(null)}
            style={[
              styles.puceCategorie,
              {
                borderColor: !categorieFiltre
                  ? colors.accent
                  : colors.border,
                borderWidth: !categorieFiltre ? 1.5 : 1,
              },
            ]}
          >
            <Text
              style={{
                color: !categorieFiltre
                  ? colors.accent
                  : colors.textSecondary,
                fontSize: 11,
              }}
            >
              {t("stock_tous", langue)}
            </Text>
          </Pressable>

          {categories.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCategorieFiltre(c)}
              style={[
                styles.puceCategorie,
                {
                  borderColor:
                    categorieFiltre === c
                      ? colors.accent
                      : colors.border,
                  borderWidth:
                    categorieFiltre === c ? 1.5 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color:
                    categorieFiltre === c
                      ? colors.accent
                      : colors.textSecondary,
                  fontSize: 11,
                }}
              >
                {c}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* =========================
          CONTENU
      ========================== */}

      {chargement ? (
        <ActivityIndicator
          style={{ marginTop: 40 }}
          color={colors.accent}
        />
      ) : produitsFiltres.length === 0 ? (
        <View style={styles.etatVide}>
          <Feather
            name="package"
            size={30}
            color={colors.textMuted}
            style={{ marginBottom: 10 }}
          />

          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 14,
              fontWeight: "500",
              marginBottom: 4,
            }}
          >
            {produits.length === 0
              ? t("stock_vide_titre", langue)
              : t("stock_aucun_resultat", langue)}
          </Text>

          {produits.length === 0 && (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 12,
                textAlign: "center",
              }}
            >
              {t("stock_vide_texte", langue)}
            </Text>
          )}
        </View>
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
              : produitsFiltres.map(rendreLigneListe)}
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
    borderRadius: 8,
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

  boutonFiltreIcone: {
    width: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },

  puceCategorie: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginRight: 6,
    alignSelf: "flex-start",
  },

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
    borderRadius: 12,
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

});

