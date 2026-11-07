import { useState, useCallback } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { Text } from "@/components/Texte";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase/client";
import { EnteteEcran, ombre } from "@/components/UI";
import { Apparition, PressableAnime } from "@/components/anim";
import { EtatVide, ListeSkeleton } from "@/components/EtatVide";
import { chargerNotifications, marquerLueLocale, NotificationItem } from "@/lib/notifications/notifications";

type Notification = NotificationItem;

const ICONES: Record<string, keyof typeof Feather.glyphMap> = {
  creance_retard: "alert-triangle",
  stock_faible: "package",
  rupture_stock: "package",
  sync_ok: "check-circle",
  sync_echec: "x-circle",
  echeance_proche: "clock",
};

export default function Notifications() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const [liste, setListe] = useState<Notification[]>([]);
  const [chargement, setChargement] = useState(true);

  // Charge via le helper : en ligne depuis Supabase (mis en cache), hors ligne
  // depuis le cache + les alertes détectées localement.
  useFocusEffect(
    useCallback(() => {
      setChargement(true);
      chargerNotifications()
        .then(setListe)
        .finally(() => setChargement(false));
    }, [])
  );

  // Compose le libellé localisé : les alertes stockent seulement le nom de
  // l'item, le préfixe est ajouté ici selon la langue de l'utilisateur.
  function libelle(n: Notification): string {
    if (n.type === "rupture_stock") return `${t("notif_rupture_stock", langue)} : ${n.message}`;
    if (n.type === "stock_faible") return `${t("notif_stock_faible", langue)} : ${n.message}`;
    if (n.type === "creance_retard") return `${t("notif_creance_retard", langue)} : ${n.message}`;
    return n.message;
  }

  // Couleur d'icône différente selon le type d'alerte.
  function couleurIcone(n: Notification): string {
    if (n.lu) return colors.textMuted;
    if (n.type === "rupture_stock" || n.type === "creance_retard") return colors.danger;
    if (n.type === "stock_faible") return colors.warning;
    return colors.textSecondary;
  }

  async function marquerLue(id: string) {
    // Local d'abord (fonctionne hors ligne), puis le serveur si possible.
    await marquerLueLocale(id);
    setListe((prev) => prev.map((n) => (n.id === id ? { ...n, lu: true } : n)));
    if (!id.startsWith("local|")) {
      try {
        await supabase.from("notifications").update({ lu: true }).eq("id", id);
      } catch {
        // Hors ligne : l'état local suffit jusqu'à la prochaine connexion.
      }
    }
  }

  const vide = liste.length === 0;
  const nonLues = liste.filter((n) => !n.lu).length;

  async function toutMarquerLu() {
    const ids = liste.filter((n) => !n.lu).map((n) => n.id);
    await Promise.all(ids.map((id) => marquerLue(id)));
  }

  // Regroupe par jour (aujourd'hui / hier / plus ancien) pour une lecture rapide.
  const debutJour = new Date(); debutJour.setHours(0, 0, 0, 0);
  const debutHier = new Date(debutJour.getTime() - 86400000);
  const groupes: { cle: string; items: Notification[] }[] = [
    { cle: "notif_groupe_aujourdhui", items: liste.filter((n) => new Date(n.created_at) >= debutJour) },
    { cle: "notif_groupe_hier", items: liste.filter((n) => new Date(n.created_at) >= debutHier && new Date(n.created_at) < debutJour) },
    { cle: "notif_groupe_avant", items: liste.filter((n) => new Date(n.created_at) < debutHier) },
  ].filter((g) => g.items.length > 0);

  function teinte(n: Notification): { fond: string; icone: string } {
    if (n.lu) return { fond: colors.border, icone: colors.textMuted };
    if (n.type === "rupture_stock" || n.type === "creance_retard" || n.type === "sync_echec") return { fond: colors.dangerBg, icone: colors.danger };
    if (n.type === "stock_faible" || n.type === "echeance_proche") return { fond: colors.warningBg ?? colors.accentBg, icone: colors.warning };
    return { fond: colors.accentBg, icone: colors.accent };
  }

  function heure(n: Notification) {
    return new Date(n.created_at).toLocaleTimeString(langue === "fr" ? "fr-FR" : "en-US", { hour: "2-digit", minute: "2-digit" });
  }

  let compteur = 0;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <EnteteEcran
        titre={t("notifications_page_titre", langue)}
        onRetour={() => router.back()}
        action={
          nonLues > 0 ? (
            <PressableAnime onPress={toutMarquerLu} hitSlop={8}>
              <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: "700" }}>{t("notif_tout_lu", langue)}</Text>
            </PressableAnime>
          ) : undefined
        }
      />

      {chargement ? (
        <ListeSkeleton lignes={5} />
      ) : vide ? (
        <EtatVide icone="bell-off" titre={t("vide_notifications_titre", langue)} texte={t("vide_notifications_texte", langue)} />
      ) : (
        groupes.map((g) => (
          <View key={g.cle} style={{ marginBottom: 14 }}>
            <Text style={[styles.groupe, { color: colors.textMuted }]}>{t(g.cle as any, langue)}</Text>
            {g.items.map((n) => {
              const c = teinte(n);
              return (
                <Apparition key={n.id} delai={Math.min(compteur++, 8) * 45} depuis={12}>
                  <PressableAnime
                    echelle={0.98}
                    onPress={() => {
                      if (!n.lu) marquerLue(n.id);
                      if (n.lien) router.push(n.lien as any);
                    }}
                  >
                    <View style={[styles.ligne, { backgroundColor: n.lu ? colors.background : colors.surface, borderColor: n.lu ? colors.border : "transparent", ...(n.lu ? {} : ombre(colors, 1)) }]}>
                      <View style={[styles.pastille, { backgroundColor: c.fond }]}>
                        <Feather name={ICONES[n.type] ?? "bell"} size={18} color={c.icone} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={2} style={{ color: n.lu ? colors.textSecondary : colors.textPrimary, fontSize: 13.5, fontWeight: n.lu ? "400" : "600", lineHeight: 19 }}>{libelle(n)}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 11.5, marginTop: 3 }}>{heure(n)}</Text>
                      </View>
                      {!n.lu ? <View style={[styles.pointNonLu, { backgroundColor: colors.accent }]} /> : null}
                      {n.lien ? <Feather name="chevron-right" size={16} color={colors.textMuted} /> : null}
                    </View>
                  </PressableAnime>
                </Apparition>
              );
            })}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, paddingTop: 50, paddingBottom: 40 },
  groupe: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8, marginLeft: 4 },
  ligne: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 18, borderWidth: 1, marginBottom: 8 },
  pastille: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  pointNonLu: { width: 9, height: 9, borderRadius: 5 },
});
