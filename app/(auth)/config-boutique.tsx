import { useLangue, t } from "@/lib/i18n";
import { useState } from "react";
import { Pressable } from "react-native";
import { Text } from "@/components/Texte";
import { EcranAuth, ChampAuth } from "@/components/EcranAuth";
import { BoutonPrimaire } from "@/components/UI";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase/client";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { chargerTauxDepuisConfig } from "@/lib/currency/taux";
import { rafraichirPlan } from "@/lib/plan/planStore";

// Cet écran ne bloque jamais l'utilisateur : "Passer" mène directement
// à l'accueil, et le nom de boutique peut être renseigné plus tard
// dans Réglages.
export default function ConfigBoutique() {
  const { langue } = useLangue();
  const { colors } = useTheme();
  const [nomBoutique, setNomBoutique] = useState("");
  const [chargement, setChargement] = useState(false);

  async function continuer(sauverNom: boolean) {
    if (chargement) return;
    setChargement(true);
    try {
      if (sauverNom && nomBoutique.trim().length > 0) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("profiles").update({ nom_boutique: nomBoutique }).eq("id", user.id);
        }
      }
      // Juste après l'inscription (en ligne) : on récupère les taux de change
      // et la config des plans/essai, sauvegardés localement pour le hors ligne.
      await Promise.all([
        chargerTauxDepuisConfig().catch(() => {}),
        rafraichirPlan().catch(() => {}),
      ]);
      router.replace("/(tabs)/accueil");
    } finally {
      setChargement(false);
    }
  }

  return (
    <EcranAuth
      titre={t("x_config_titre", langue)}
      sousTitre={t("x_config_sous", langue)}
      retour={false}
      pied={
        <Pressable onPress={() => continuer(false)} hitSlop={10}>
          <Text style={{ color: "#fff", fontSize: 13.5, fontWeight: "600" }}>{t("x_passer", langue)}</Text>
        </Pressable>
      }
    >
      <Text style={{ color: colors.textSecondary, fontSize: 12.5, fontWeight: "600", marginBottom: 8 }}>{t("x_config_nom", langue)}</Text>
      <ChampAuth icone="shopping-bag" valeur={nomBoutique} onChange={setNomBoutique} placeholder={t("x_config_nom_ph", langue)} />
      <BoutonPrimaire texte={chargement ? "…" : t("x_continuer", langue)} icone="arrow-right" onPress={() => continuer(true)} disabled={chargement} />
    </EcranAuth>
  );
}
