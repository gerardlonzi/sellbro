import { useState, useCallback } from "react";
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { obtenirUserId } from "@/lib/auth/userCache";
import { PanneauFiltre } from "@/components/PanneauFiltre";
import { ValeursFiltre, VALEURS_FILTRE_VIDES } from "@/lib/filtres/types";
import { dansPlageMontant } from "@/lib/filtres/appliquerFiltres";
import { MenuContextuel } from "@/components/MenuContextuel";
import { router, useFocusEffect } from "expo-router";


type Client = { nom: string; total: number; nbAchats: number; aCreance: boolean };

export default function Clients() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const [recherche, setRecherche] = useState("");
  const [rechercheOuverte, setRechercheOuverte] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [chargement, setChargement] = useState(true);
  const [filtres, setFiltres] = useState<ValeursFiltre>(VALEURS_FILTRE_VIDES);
  const [panneauOuvert, setPanneauOuvert] = useState(false);

  useFocusEffect(
    useCallback(() => {
      chargerClients();
    }, [])
  );

  async function chargerClients() {
    setChargement(true);
    const userId = await obtenirUserId();
    if (!userId) { setChargement(false); return; }
    const ventes = await database.get("ventes").query(Q.where("user_id", userId)).fetch();
    const creances = await database.get("creances_dettes").query(Q.where("user_id", userId), Q.where("type", "creance")).fetch();

    const noms_avec_creance = new Set((creances as any[]).filter((c) => c.statut !== "payee").map((c) => c.personneNom));

    const regroupes: Record<string, Client> = {};
    for (const v of ventes as any[]) {
      if (!v.clientNom) continue;
      if (!regroupes[v.clientNom]) regroupes[v.clientNom] = { nom: v.clientNom, total: 0, nbAchats: 0, aCreance: noms_avec_creance.has(v.clientNom) };
      regroupes[v.clientNom].total += v.quantite * v.prixUnitaire;
      regroupes[v.clientNom].nbAchats += 1;
    }
    setClients(Object.values(regroupes).sort((a, b) => b.total - a.total));
    setChargement(false);
  }

  let filtrees = clients.filter((c) => c.nom.toLowerCase().includes(recherche.toLowerCase()));
  if (filtres.statut === "creance") filtrees = filtrees.filter((c) => c.aCreance);
  filtrees = filtrees.filter((c) => dansPlageMontant(c.total, filtres));

  if (filtres.tri === "meilleurs_clients") filtrees = [...filtrees].sort((a, b) => b.total - a.total);
  if (filtres.tri === "plus_fideles") filtrees = [...filtrees].sort((a, b) => b.nbAchats - a.nbAchats);
  if (filtres.tri === "nom_az") filtrees = [...filtrees].sort((a, b) => a.nom.localeCompare(b.nom));

  const filtreActif = filtres.tri !== "" || filtres.statut !== "tous" || filtres.montantMin !== "" || filtres.montantMax !== "";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 10, alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 16, fontWeight: "500", color: colors.textPrimary, marginBottom: 12 }}>{t("clients_titre", langue)}</Text>
        <View style={{flexDirection:"row", gap: 3}}>
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
          <Pressable onPress={() => setPanneauOuvert(true)} style={[styles.boutonFiltreIcone]}>
            <Feather name="sliders" size={16} color={filtreActif ? colors.accent : colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {rechercheOuverte && (
        <View style={styles.conteneurRecherche}>
          <TextInput
            autoFocus
            placeholder={t("clients_recherche", langue)}
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


      {chargement ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : filtrees.length === 0 ? (
        <View style={styles.etatVide}>
          <Feather name="users" size={30} color={colors.textMuted} style={{ marginBottom: 10 }} />
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "500", marginBottom: 4 }}>
            {clients.length === 0 ? t("clients_vide_titre", langue) : t("clients_aucun_resultat", langue)}
          </Text>
          {clients.length === 0 && (
            <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: "center" }}>{t("clients_vide_texte", langue)}</Text>
          )}
        </View>
      ) : (
        <ScrollView>
          {filtrees.map((c) => (
            <View key={c.nom} style={[styles.ligne, { borderBottomColor: colors.border }]}>
              <View style={styles.ligneGauche}>
                <View style={[styles.avatar, { backgroundColor: colors.accentBg }]}>
                  <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "500" }}>{c.nom.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{c.nom}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{c.nbAchats} {t("clients_achats", langue)}</Text>
                </View>
                {c.aCreance && <View style={[styles.pointCreance, { backgroundColor: colors.danger }]} />}
              </View>
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500", marginRight: 10 }}>{c.total.toLocaleString()} F</Text>
              <MenuContextuel actions={[{ label: "Voir historique", icone: "list", onPress: () => router.push({ pathname: "/commandes", params: { client: c.nom } }) }]} />
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
            { valeur: "meilleurs_clients", labelCle: "tri_meilleurs_clients" },
            { valeur: "plus_fideles", labelCle: "tri_plus_fideles" },
            { valeur: "nom_az", labelCle: "tri_nom_az" },
          ],
          statut: [
            { valeur: "tous", labelCle: "clients_statut_tous" },
            { valeur: "creance", labelCle: "clients_statut_creance" },
          ],
          avecMontant: true,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  boutonFiltreIcone: { width: 42, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  etatVide: { alignItems: "center", paddingTop: 50 },
  ligne: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1 },
  ligneGauche: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  pointCreance: { width: 8, height: 8, borderRadius: 4, marginLeft: 4 },
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
  boutonEntete: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },


});