import { useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, Linking, TextInput } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { database } from "@/lib/database";
import { obtenirUserId } from "@/lib/auth/userCache";
import { Q } from "@nozbe/watermelondb";
import { EnteteEcran } from "@/components/UI";
import { BoutonFlottant } from "@/components/BoutonFlottant";

type Fournisseur = {
  id: string;
  nom: string;
  telephone: string | null;
  adresse: string | null;
  description: string | null;
  montantDu: number;
  champs: Record<string, string>;
};

type Tri = "nom" | "dette";

export default function Fournisseurs() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { formater } = useCurrency();
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

      {/* Total des montants dus */}
      {!chargement && totalDu > 0 && (
        <View style={[styles.bandeauTotal, { backgroundColor: colors.dangerBg }]}>
          <Text style={{ color: colors.danger, fontSize: 12 }}>
            {t("fournisseurs_du", langue)} : {formater(totalDu)} ({filtres.length})
          </Text>
        </View>
      )}

      {chargement ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : filtres.length === 0 ? (
        <View style={styles.etatVide}>
          <Feather name="truck" size={30} color={colors.textMuted} style={{ marginBottom: 10 }} />
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t("fournisseurs_vide", langue)}</Text>
        </View>
      ) : (
        <ScrollView>
          {filtres.map((f) => (
            <View key={f.id} style={[styles.ligne, { borderBottomColor: colors.border }]}>
              <View style={[styles.avatar, { backgroundColor: colors.accentBg }]}>
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "500" }}>{f.nom.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{f.nom}</Text>
                {f.description ? <Text style={{ color: colors.textMuted, fontSize: 11 }}>{f.description}</Text> : null}
                {f.adresse ? <Text style={{ color: colors.textMuted, fontSize: 11 }}>{f.adresse}</Text> : null}
                {Object.entries(f.champs).map(([nom, valeur]) => (
                  <Text key={nom} style={{ color: colors.textMuted, fontSize: 11 }}>{nom} : {valeur}</Text>
                ))}
              </View>
              {f.telephone ? (
                <Pressable onPress={() => Linking.openURL(`tel:${f.telephone}`)} hitSlop={8} style={{ padding: 6 }}>
                  <Feather name="phone" size={15} color={colors.accent} />
                </Pressable>
              ) : null}
              {f.montantDu > 0 && (
                <Text style={{ color: colors.danger, fontSize: 12 }}>{t("fournisseurs_du", langue)} {formater(f.montantDu)}</Text>
              )}
            </View>
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
  barreRecherche: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 },
  ligneFiltres: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  bandeauTotal: { padding: 10, borderRadius: 10, marginBottom: 12 },
  etatVide: { alignItems: "center", paddingTop: 40 },
  ligne: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
});
