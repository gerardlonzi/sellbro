
import { useState, useCallback } from "react";

import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Image,
} from "react-native";

import { router, useFocusEffect } from "expo-router";

import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

import { useTheme } from "@/lib/theme/ThemeProvider";

import { useLangue, t } from "@/lib/i18n";

import { useCategories } from "@/lib/categories/CategoriesProvider";

import { Badge } from "@/components/UI";

import { PanneauFiltre } from "@/components/PanneauFiltre";

import {
  ValeursFiltre,
  VALEURS_FILTRE_VIDES,
} from "@/lib/filtres/types";

import { MenuContextuel } from "@/components/MenuContextuel";

import { BoutonFlottant } from "@/components/BoutonFlottant";

import { usePlanActuel } from "@/lib/plan/usePlanActuel";

import { database } from "@/lib/database";

import { Q } from "@nozbe/watermelondb";

import { obtenirUserId } from "@/lib/auth/userCache";

type Produit = {
  id: string;
  nom: string;
  prix_vente: number;
  quantite_stock: number;
  seuil_alerte: number;
  categorie_nom: string | null;
  image_uri: string | null;
};

export default function Stock() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { plan } = usePlanActuel();
  const { categories } = useCategories();

  const [recherche, setRecherche] = useState("");
  const [rechercheOuverte, setRechercheOuverte] = useState(false);

  const [categorieFiltre, setCategorieFiltre] = useState<string | null>(
    null
  );

  const [produits, setProduits] = useState<Produit[]>([]);
  const [chargement, setChargement] = useState(true);

  const [filtres, setFiltres] = useState<ValeursFiltre>(
    VALEURS_FILTRE_VIDES
  );

  const [panneauOuvert, setPanneauOuvert] = useState(false);

  useFocusEffect(
    useCallback(() => {
      chargerProduits();
    }, [])
  );

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

    setProduits(
      resultats.map((p: any) => ({
        id: p.id,
        nom: p.nom,
        prix_vente: p.prixVente,
        quantite_stock: p.quantiteStock,
        seuil_alerte: p.seuilAlerte,
        categorie_nom: p.categorieNom,
        image_uri: p.champsSupplementaires?.image_uri ?? null,
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
        <Text
          style={{
            fontSize: 16,
            fontWeight: "500",
            color: colors.textPrimary,
          }}
        >
          {t("stock_titre", langue)}
        </Text>

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
        <ScrollView>
          {produitsFiltres.map((p) => (
            <View
              key={p.id}
              style={[
                styles.ligneProduit,
                {
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                {p.image_uri ? (
                  <Image source={{ uri: p.image_uri }} style={styles.apercuImage} />
                ) : null}
                <View>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: 13,
                      fontWeight: "500",
                    }}
                  >
                    {p.nom}
                  </Text>

                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 11,
                    }}
                  >
                    {p.prix_vente.toLocaleString()} F
                  </Text>
                </View>
              </View>

              {p.quantite_stock <= p.seuil_alerte ? (
                <Badge
                  texte={`${p.quantite_stock} ${t(
                    "stock_en_stock",
                    langue
                  )}`}
                  type="attention"
                />
              ) : (
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 13,
                    fontWeight: "500",
                  }}
                >
                  {p.quantite_stock}{" "}
                  {t("stock_en_stock", langue)}
                </Text>
              )}

              <MenuContextuel
                actions={[
                  {
                    label:
                      t("produit_sauver", langue) === "Save"
                        ? "Edit"
                        : "Modifier",
                    icone: "edit-3",
                    onPress: () =>
                      router.push(`/produit/${p.id}`),
                  },
                  {
                    label: t(
                      "categories_supprimer_confirmer",
                      langue
                    ),
                    icone: "trash-2",
                    destructif: true,
                    onPress: async () => {
                      const enreg = await database
                        .get("produits")
                        .find(p.id);
                      await database.write(async () => {
                        await (enreg as any).destroyPermanently();
                      });
                      chargerProduits();
                    },
                  },
                ]}
              />
            </View>
          ))}
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
});

