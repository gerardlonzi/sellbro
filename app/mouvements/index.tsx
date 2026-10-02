import { useCallback, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Q } from "@nozbe/watermelondb";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { database } from "@/lib/database";
import { obtenirUserId } from "@/lib/auth/userCache";
import { EnteteEcran, Skeleton } from "@/components/UI";
import { PuceIcone, TonPuce } from "@/components/PuceIcone";
import { formaterDate } from "@/lib/formatDate";
import { versionDonnees } from "@/lib/dataVersion";

type Ligne = {
  id: string;
  type: string;
  quantite: number;
  stockApres: number;
  nomProduit: string;
  creeLe: Date;
};

// Présentation de chaque type de mouvement : le signe distingue une entrée
// d'une sortie, la pastille porte la couleur. `mouvement_type_*` vient de
// l'i18n — aucune correspondance de libellé en dur ici.
const TYPES: Record<string, { icone: keyof typeof Feather.glyphMap; ton: TonPuce }> = {
  achat: { icone: "arrow-down-left", ton: "vert" },
  vente: { icone: "arrow-up-right", ton: "bleu" },
  retour: { icone: "corner-up-left", ton: "lilas" },
  casse: { icone: "x-octagon", ton: "rose" },
  ajustement: { icone: "sliders", ton: "ambre" },
  peremption: { icone: "clock", ton: "rose" },
};

export default function Mouvements() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [chargement, setChargement] = useState(true);
  const derniereVersion = useRef<number | null>(null);

  // Ne recharge que si les données ont changé depuis la dernière visite —
  // même principe que les écrans Stock et Clients.
  useFocusEffect(
    useCallback(() => {
      if (derniereVersion.current === null || versionDonnees() !== derniereVersion.current) {
        derniereVersion.current = versionDonnees();
        charger();
      }
    }, [])
  );

  async function charger() {
    setChargement(true);
    const userId = await obtenirUserId();
    if (!userId) {
      setChargement(false);
      return;
    }

    const [mouvements, produits] = await Promise.all([
      database.get("mouvements_stock").query(Q.where("user_id", userId), Q.sortBy("cree_le", Q.desc)).fetch(),
      database.get("produits").query(Q.where("user_id", userId)).fetch(),
    ]);

    const nomParId = new Map((produits as any[]).map((p) => [p.id, p.nom]));
    setLignes(
      (mouvements as any[]).map((m) => ({
        id: m.id,
        type: m.type,
        quantite: m.quantite,
        stockApres: m.stockApres,
        nomProduit: nomParId.get(m.produitId) ?? "—",
        creeLe: m.creeLe,
      }))
    );
    setChargement(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 14, paddingTop: 50 }}>
      <EnteteEcran titre={t("mouvements_titre", langue)} onRetour={() => router.back()} />

      {chargement ? (
        <View style={{ gap: 10 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={54} />
          ))}
        </View>
      ) : lignes.length === 0 ? (
        <View style={styles.vide}>
          <Feather name="refresh-cw" size={28} color={colors.textMuted} />
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 10, textAlign: "center" }}>
            {t("mouvements_aucun", langue)}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          {lignes.map((ligne) => {
            const presentation = TYPES[ligne.type] ?? { icone: "refresh-cw" as const, ton: "bleu" as TonPuce };
            const entree = ligne.quantite >= 0;
            return (
              <View key={ligne.id} style={[styles.ligne, { borderBottomColor: colors.border }]}>
                <PuceIcone icone={presentation.icone} ton={presentation.ton} taille={34} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 13 }} numberOfLines={1}>
                    {ligne.nomProduit}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>
                    {t(`mouvement_type_${ligne.type}` as any, langue) as string} · {formaterDate(ligne.creeLe, langue)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: entree ? colors.success : colors.danger, fontSize: 14, fontWeight: "700" }}>
                    {entree ? "+" : ""}
                    {ligne.quantite}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    {t("stock_en_stock", langue)} : {ligne.stockApres}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  vide: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 60 },
});
