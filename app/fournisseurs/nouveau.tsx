import { useState } from "react";
import { View, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { Text, TextInput } from "@/components/Texte";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { useLangue, t } from "@/lib/i18n";
import { database } from "@/lib/database";
import { EnteteEcran } from "@/components/UI";
import { SectionForm, ChampTexte, PucesChoix, BarreSauvegarde } from "@/components/Formulaire";
import { obtenirUserId } from "@/lib/auth/userCache";
import { synchroniserPourUtilisateurCourant } from "@/lib/database/sync";
import { enregistrerActivite } from "@/lib/audit/journal";
import { peutEcrire } from "@/lib/trial/gate";
import { afficherPaywall } from "@/lib/trial/paywall";
import { usePays } from "@/lib/pays/PaysProvider";
import { validerTelephone } from "@/lib/pays/validation";

export default function NouveauFournisseur() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { showToast } = useToast();
  const { pays } = usePays();
  const [nom, setNom] = useState("");
  const [contact, setContact] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [adresse, setAdresse] = useState("");
  const [produitsFournis, setProduitsFournis] = useState("");
  const [conditions, setConditions] = useState<"comptant" | "7j" | "15j" | "30j" | null>("comptant");
  const [description, setDescription] = useState("");
  const [champs, setChamps] = useState<{ nom: string; valeur: string }[]>([]);
  const [chargement, setChargement] = useState(false);

  async function sauvegarder() {
    if (chargement) return;
    if (!(await peutEcrire())) {
      afficherPaywall(langue, () => router.push("/premium"));
      return;
    }
    if (!nom.trim()) {
      showToast(t("fournisseur_erreur_nom", langue), "error");
      return;
    }
    if (telephone.trim()) {
      const validation = validerTelephone(telephone.trim(), pays, langue);
      if (!validation.valide) {
        showToast(validation.message ?? t("inscription_verifie_numero", langue), "error");
        return;
      }
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showToast(t("erreur_email_invalide", langue), "error");
      return;
    }
    setChargement(true);
    try {
      const userId = await obtenirUserId();
      if (!userId) return;
      // Champs personnalisés : uniquement ceux avec un nom ET une valeur.
      const champsValides = champs.filter((c) => c.nom.trim() && c.valeur.trim());
      await database.write(async () => {
        await database.get("fournisseurs").create((f: any) => {
          f.userId = userId;
          f.nom = nom.trim();
          f.telephone = telephone.trim() ? `${pays.indicatif}${telephone.replace(/\s/g, "")}` : null;
          f.adresse = adresse.trim() || null;
          f.totalAchats = 0;
          f.montantDu = 0;
          // Les nouveaux champs vivent dans le JSON existant : aucune
          // migration de base de données n'est nécessaire.
          const donnees: Record<string, unknown> = {};
          if (description.trim()) donnees.description = description.trim();
          if (contact.trim()) donnees.contact = contact.trim();
          if (email.trim()) donnees.email = email.trim();
          if (produitsFournis.trim()) donnees.produits_fournis = produitsFournis.trim();
          if (conditions) donnees.conditions_paiement = conditions;
          if (champsValides.length > 0) donnees.champs = Object.fromEntries(champsValides.map((c) => [c.nom.trim(), c.valeur.trim()]));
          f.donneesSupplementairesJson = JSON.stringify(donnees);
          f.creeLe = new Date();
          f.synchronise = false;
        });
      });

      synchroniserPourUtilisateurCourant().catch(() => {});
      await enregistrerActivite("fournisseur", "ajout", `Fournisseur ajouté : ${nom}`);
      showToast(t("toast_enregistre", langue), "success");
      router.back();
    } catch {
      showToast(t("erreur_enregistrement", langue), "error");
    } finally {
      setChargement(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <EnteteEcran titre={t("fournisseurs_ajouter", langue)} onRetour={() => router.back()} />

        <SectionForm titre={t("fournisseur_section_identite", langue)} icone="truck" ton="ambre">
          <ChampTexte label={t("fournisseurs_nom", langue)} icone="briefcase" valeur={nom} onChange={setNom} placeholder={t("fournisseur_nom_ph", langue)} />
          <ChampTexte label={t("fournisseur_contact", langue)} icone="user" valeur={contact} onChange={setContact} placeholder={t("fournisseur_contact_ph", langue)} />
          <ChampTexte label={t("fournisseur_produits_fournis", langue)} icone="package" valeur={produitsFournis} onChange={setProduitsFournis} placeholder={t("fournisseur_produits_ph", langue)} />
        </SectionForm>

        <SectionForm titre={t("fournisseur_section_contact", langue)} icone="phone" ton="vert" delai={60}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginBottom: 6, marginLeft: 2 }}>{t("fournisseurs_telephone", langue)}</Text>
          <View style={styles.ligneNumero}>
            <Pressable onPress={() => router.push("/pays")} style={[styles.indicatif, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={{ fontSize: 14, color: colors.textPrimary }}>{pays.drapeau} {pays.indicatif}</Text>
              <Feather name="chevron-down" size={12} color={colors.textMuted} />
            </Pressable>
            <TextInput
              value={telephone}
              onChangeText={setTelephone}
              placeholder="6XX XXX XXX"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              style={[styles.inputNumero, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.background }]}
            />
          </View>
          <ChampTexte label={t("fournisseur_email", langue)} icone="mail" valeur={email} onChange={setEmail} clavier="email-address" autoCapitalize="none" placeholder="contact@exemple.com" />
          <ChampTexte label={t("fournisseurs_adresse", langue)} icone="map-pin" valeur={adresse} onChange={setAdresse} />
        </SectionForm>

        <SectionForm titre={t("fournisseur_section_commerce", langue)} icone="credit-card" ton="bleu" delai={120}>
          <PucesChoix
            label={t("fournisseur_conditions", langue)}
            valeur={conditions}
            onChange={setConditions}
            options={[
              { id: "comptant", libelle: t("conditions_comptant", langue), icone: "dollar-sign" },
              { id: "7j", libelle: t("conditions_7j", langue) },
              { id: "15j", libelle: t("conditions_15j", langue) },
              { id: "30j", libelle: t("conditions_30j", langue) },
            ]}
          />
          <ChampTexte label={t("fournisseurs_description", langue)} icone="file-text" valeur={description} onChange={setDescription} multiligne placeholder={t("fournisseur_note_ph", langue)} />
        </SectionForm>

        <SectionForm titre={t("champs_personnalises", langue)} icone="sliders" ton="lilas" delai={180}>
          {champs.map((c, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <TextInput
                value={c.nom}
                onChangeText={(v) => setChamps((actuel) => actuel.map((x, j) => (j === i ? { ...x, nom: v } : x)))}
                placeholder={t("champ_nom", langue)}
                placeholderTextColor={colors.textMuted}
                style={[styles.inputNumero, { flex: 1, borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.background }]}
              />
              <TextInput
                value={c.valeur}
                onChangeText={(v) => setChamps((actuel) => actuel.map((x, j) => (j === i ? { ...x, valeur: v } : x)))}
                placeholder={t("champ_valeur", langue)}
                placeholderTextColor={colors.textMuted}
                style={[styles.inputNumero, { flex: 1, borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.background }]}
              />
              <Pressable onPress={() => setChamps((actuel) => actuel.filter((_, j) => j !== i))} hitSlop={8}>
                <Feather name="x" size={16} color={colors.danger} />
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={() => setChamps((actuel) => [...actuel, { nom: "", valeur: "" }])}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}
          >
            <Feather name="plus" size={13} color={colors.accent} />
            <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: "600" }}>{t("champ_ajouter", langue)}</Text>
          </Pressable>
        </SectionForm>
      </ScrollView>

      <BarreSauvegarde texte={t("nouvelle_creance_sauver", langue)} onPress={sauvegarder} chargement={chargement} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 50, paddingBottom: 30 },
  ligneNumero: { flexDirection: "row", gap: 8, marginBottom: 14 },
  indicatif: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5 },
  inputNumero: { flex: 1, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
});
