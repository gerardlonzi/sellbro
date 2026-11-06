import { useState, useCallback } from "react";
import { View, ScrollView, StyleSheet, ActivityIndicator, Pressable, Linking } from "react-native";
import { EtatVide, ListeSkeleton } from "@/components/EtatVide";
import { Text, TextInput } from "@/components/Texte";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { database } from "@/lib/database";
import { obtenirUserId } from "@/lib/auth/userCache";
import { Q } from "@nozbe/watermelondb";
import { EnteteEcran, ombre } from "@/components/UI";
import { Apparition, PressableAnime } from "@/components/anim";
import { AvatarNom } from "@/components/AvatarNom";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BoutonFlottant } from "@/components/BoutonFlottant";

type Fournisseur = {
  id: string;
  nom: string;
  telephone: string | null;
  adresse: string | null;
  description: string | null;
  contact: string | null;
  email: string | null;
  produitsFournis: string | null;
  conditions: string | null;
  montantDu: number;
  champs: Record<string, string>;
};

type Tri = "nom" | "dette";

export default function Fournisseurs() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { formaterCompact } = useCurrency();
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [filtresVisibles, setFiltresVisibles] = useState(false);
  const [seulementDette, setSeulementDette] = useState(false);
  const [tri, setTri] = useState<Tri>("nom");

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [])
  );

  async function charger() {
    setChargement(true);
    const userId = await obtenirUserId();
    if (!userId) { setChargement(false); return; }
    const resultats = await database.get("fournisseurs").query(Q.where("user_id", userId)).fetch();
    setFournisseurs((resultats as any[]).map((f) => {
      let supp: any = {};
      try { supp = JSON.parse(f.donneesSupplementairesJson || "{}"); } catch {}
      return {
        id: f.id,
        nom: f.nom,
        telephone: f.telephone,
        adresse: f.adresse ?? null,
        description: supp.description ?? null,
        contact: supp.contact ?? null,
        email: supp.email ?? null,
        produitsFournis: supp.produits_fournis ?? null,
        conditions: supp.conditions_paiement ?? null,
        montantDu: f.montantDu,
        champs: supp.champs ?? {},
      };
    }));
    setChargement(false);
  }

  const texteRecherche = recherche.trim().toLowerCase();
  const filtres = fournisseurs
    .filter((f) => {
      if (seulementDette && f.montantDu <= 0) return false;
      if (texteRecherche) {
        const contenu = [f.nom, f.telephone ?? "", f.adresse ?? "", f.description ?? "", ...Object.entries(f.champs).flat()]
          .join(" ")
          .toLowerCase();
        if (!contenu.includes(texteRecherche)) return false;
      }
      return true;
    })
    .sort((a, b) => (tri === "dette" ? b.montantDu - a.montantDu : a.nom.localeCompare(b.nom)));

  const filtreActif = seulementDette || tri !== "nom";
  const totalDu = filtres.reduce((s, f) => s + f.montantDu, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <EnteteEcran
        titre={t("fournisseurs_titre", langue)}
        onRetour={() => router.back()}
        action={
          <Pressable
            onPress={() => setFiltresVisibles((v) => !v)}
            style={[styles.boutonFiltre, { borderColor: filtreActif ? colors.accent : colors.border, borderWidth: filtreActif ? 1.5 : 1 }]}
            hitSlop={8}
          >
            <Feather name="sliders" size={16} color={filtreActif ? colors.accent : colors.textSecondary} />
          </Pressable>
        }
      />

      {/* Barre de recherche */}
      <View style={[styles.barreRecherche, { borderColor: colors.border }]}>
        <Feather name="search" size={14} color={colors.textMuted} />
        <TextInput
          value={recherche}
          onChangeText={setRecherche}
          placeholder={t("fournisseurs_rechercher", langue)}
          placeholderTextColor={colors.textMuted}
          style={{ flex: 1, color: colors.textPrimary, fontSize: 13, paddingVertical: 0 }}
        />
        {recherche.length > 0 && (
          <Pressable onPress={() => setRecherche("")} hitSlop={8}>
            <Feather name="x" size={14} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Filtres : montant dû + tri */}
      {filtresVisibles && (
        <View style={styles.ligneFiltres}>
          <PuceFiltre
            label={t("fournisseurs_filtre_dette", langue)}
            actif={seulementDette}
            onPress={() => setSeulementDette((v) => !v)}
            colors={colors}
          />
          <PuceFiltre
            label="A → Z"
            actif={tri === "nom"}
            onPress={() => setTri("nom")}
            colors={colors}
          />
          <PuceFiltre
            label={`${t("fournisseurs_du", langue)} ↓`}
            actif={tri === "dette"}
            onPress={() => setTri("dette")}
            colors={colors}
          />
        </View>
      )}

      {/* Résumé : nombre de fournisseurs et total dû */}
      {!chargement && fournisseurs.length > 0 && (
        <Apparition>
          <LinearGradient colors={totalDu > 0 ? ["#F2776B", "#D64545"] : [colors.accentClair, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.resume}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" }}>{t("fournisseurs_du", langue)}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 2 }}>{formaterCompact(totalDu)}</Text>
            </View>
            <View style={styles.resumeNb}>
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>{fournisseurs.length}</Text>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 10.5 }}>{t("fournisseurs_titre_court", langue)}</Text>
            </View>
          </LinearGradient>
        </Apparition>
      )}

      {chargement ? (
        <ListeSkeleton />
      ) : filtres.length === 0 ? (
        <EtatVide
          icone="truck"
          titre={t("fournisseurs_vide", langue)}
          texte={t("vide_fournisseurs_texte", langue)}
          actionLibelle={t("vide_action_fournisseur", langue)}
          onAction={() => router.push("/fournisseurs/nouveau")}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 90 }}>
          {filtres.map((f, i) => (
            <Apparition key={f.id} delai={Math.min(i, 8) * 40} depuis={10}>
              <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border }, ombre(colors, 1)]}>
                <View style={styles.ligneHaut}>
                  <AvatarNom nom={f.nom} taille={44} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 14.5, fontWeight: "700" }}>{f.nom}</Text>
                    {f.contact ? <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{f.contact}</Text> : null}
                    {f.produitsFournis ? <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 11.5, marginTop: 2 }}>{f.produitsFournis}</Text> : null}
                  </View>
                  {f.montantDu > 0 ? (
                    <View style={[styles.pastille, { backgroundColor: colors.dangerBg }]}>
                      <Text style={{ color: colors.danger, fontSize: 12, fontWeight: "800" }}>{formaterCompact(f.montantDu)}</Text>
                    </View>
                  ) : (
                    <View style={[styles.pastille, { backgroundColor: colors.successBg }]}>
                      <Feather name="check" size={12} color={colors.success} />
                    </View>
                  )}
                </View>

                {(f.conditions || f.adresse || f.email) && (
                  <View style={styles.infos}>
                    {f.conditions ? (
                      <View style={[styles.pastille, { backgroundColor: colors.accentBg }]}>
                        <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "700" }}>{t(`conditions_${f.conditions}` as any, langue)}</Text>
                      </View>
                    ) : null}
                    {f.adresse ? (
                      <View style={styles.info}><Feather name="map-pin" size={11} color={colors.textMuted} /><Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 11.5, flexShrink: 1 }}>{f.adresse}</Text></View>
                    ) : null}
                    {f.email ? (
                      <View style={styles.info}><Feather name="mail" size={11} color={colors.textMuted} /><Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 11.5, flexShrink: 1 }}>{f.email}</Text></View>
                    ) : null}
                  </View>
                )}
                {f.description ? <Text style={{ color: colors.textMuted, fontSize: 11.5, marginTop: 8, lineHeight: 16 }}>{f.description}</Text> : null}
                {Object.entries(f.champs).map(([nom, valeur]) => (
                  <Text key={nom} style={{ color: colors.textMuted, fontSize: 11.5, marginTop: 2 }}>{nom} : {valeur}</Text>
                ))}

                {f.telephone ? (
                  <View style={[styles.actions, { borderTopColor: colors.border }]}>
                    <PressableAnime onPress={() => Linking.openURL(`tel:${f.telephone}`)} style={[styles.boutonAction, { backgroundColor: colors.accentBg, flex: 1 }]}>
                      <Feather name="phone" size={14} color={colors.accent} />
                      <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: "700" }}>{t("fournisseur_appeler", langue)}</Text>
                    </PressableAnime>
                    <PressableAnime onPress={() => Linking.openURL(`https://wa.me/${f.telephone!.replace("+", "")}`)} style={[styles.boutonAction, { backgroundColor: "#1D9E75", flex: 1 }]}>
                      <MaterialCommunityIcons name="whatsapp" size={15} color="#fff" />
                      <Text style={{ color: "#fff", fontSize: 12.5, fontWeight: "700" }}>WhatsApp</Text>
                    </PressableAnime>
                  </View>
                ) : null}
              </View>
            </Apparition>
          ))}
        </ScrollView>
      )}

      <BoutonFlottant onPress={() => router.push("/fournisseurs/nouveau")} />
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
  barreRecherche: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  resume: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 20, marginBottom: 12 },
  resumeNb: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 },
  carte: { borderWidth: 1, borderRadius: 20, padding: 14, marginBottom: 10 },
  ligneHaut: { flexDirection: "row", alignItems: "center", gap: 12 },
  pastille: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 11 },
  infos: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 },
  info: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  boutonAction: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12 },
  ligneFiltres: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  bandeauTotal: { padding: 10, borderRadius: 10, marginBottom: 12 },
  etatVide: { alignItems: "center", paddingTop: 40 },
  ligne: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
});
