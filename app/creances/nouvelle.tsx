import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Modal } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { useLangue, t } from "@/lib/i18n";
import { usePlanActuel } from "@/lib/plan/usePlanActuel";
import { EnteteEcran } from "@/components/UI";
import { obtenirUserId } from "@/lib/auth/userCache";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { synchroniserPourUtilisateurCourant } from "@/lib/database/sync";
import { enregistrerActivite } from "@/lib/audit/journal";
import { peutEcrire } from "@/lib/trial/gate";
import { afficherPaywall } from "@/lib/trial/paywall";
import { usePays } from "@/lib/pays/PaysProvider";
import { validerTelephone } from "@/lib/pays/validation";
import { formaterDateSeule } from "@/lib/formatDate";
import DateTimePicker from "@react-native-community/datetimepicker";

const CHAMPS_SUGGERES = [
  { cle: "note", labelCle: "nouvelle_creance_champ_note" },
  { cle: "produit", labelCle: "nouvelle_creance_champ_produit" },
];

export default function NouvelleCreance() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { showToast } = useToast();
  const { plan } = usePlanActuel();
  const { pays } = usePays();
  const { type: typeParam } = useLocalSearchParams<{ type?: string }>();
  const [type, setType] = useState<"creance" | "dette">(typeParam === "dette" ? "dette" : "creance");
  const [personne, setPersonne] = useState("");
  const [telephone, setTelephone] = useState("");
  const [montant, setMontant] = useState("");
  const [echeance, setEcheance] = useState("");
  const [afficherDatePicker, setAfficherDatePicker] = useState(false);
  const [champsActifs, setChampsActifs] = useState<string[]>([]);
  const [valeursChamps, setValeursChamps] = useState<Record<string, string>>({});
  const [chargement, setChargement] = useState(false);
  const [produits, setProduits] = useState<{ id: string; nom: string }[]>([]);
  const [selecteurProduitOuvert, setSelecteurProduitOuvert] = useState(false);
  const [produitsSelectionnes, setProduitsSelectionnes] = useState<string[]>([]);

  function basculerChamp(cle: string) {
    setChampsActifs((actuels) => (actuels.includes(cle) ? actuels.filter((c) => c !== cle) : [...actuels, cle]));
  }

  async function ouvrirSelecteurProduit() {
    const userId = await obtenirUserId();
    if (!userId) return;
    const resultats = await database.get("produits").query(Q.where("user_id", userId)).fetch();
    setProduits((resultats as any[]).map((p) => ({ id: p.id, nom: p.nom })));
    setSelecteurProduitOuvert(true);
  }

  function basculerProduit(nom: string) {
    setProduitsSelectionnes((actuels) =>
      actuels.includes(nom) ? actuels.filter((x) => x !== nom) : [...actuels, nom]
    );
  }

  async function sauvegarder() {
    if (chargement) return;
    if (!(await peutEcrire())) {
      afficherPaywall(langue, () => router.push("/premium"));
      return;
    }
    if (!personne.trim() || !montant) {
      showToast(t("nouvelle_creance_erreur", langue), "error");
      return;
    }

    // Téléphone facultatif, mais si renseigné il doit être valide pour le pays.
    if (telephone.trim()) {
      const validation = validerTelephone(telephone.trim(), pays);
      if (!validation.valide) {
        showToast(validation.message ?? t("inscription_verifie_numero", langue), "error");
        return;
      }
    }

    const userId = await obtenirUserId();
    if (!userId) return;

    setChargement(true);

    // Limite du plan Gratuit : nombre de créances/dettes actives.
    // plan.quotaCreances === null signifie illimité (Starter/Premium).
    if (plan?.quotaCreances) {
      const actives = await database
        .get("creances_dettes")
        .query(Q.where("user_id", userId), Q.where("statut", Q.notEq("payee")))
        .fetchCount();

      if (actives >= plan.quotaCreances) {
        setChargement(false);
        router.push("/premium");
        return;
      }
    }

    await database.write(async () => {
      await database.get("creances_dettes").create((c: any) => {
        c.userId = userId;
        c.type = type;
        c.personneNom = personne.trim();
        c.telephone = telephone.trim() ? `${pays.indicatif}${telephone.replace(/\s/g, "")}` : null;
        c.montantInitial = Number(montant);
        c.montantRestant = Number(montant);
        c.dateEcheance = echeance || null;
        c.statut = "en_cours";
        c.note = valeursChamps.note || null;
        c.produitConcerne = produitsSelectionnes.length > 0 ? produitsSelectionnes.join(", ") : null;
        c.creeLe = new Date();
        c.synchronise = false;
      });
    });

    synchroniserPourUtilisateurCourant().catch(() => {});
    await enregistrerActivite("creance", "ajout", type === "creance" ? "Nouvelle créance" : "Nouvelle dette");
    setChargement(false);
    showToast(t("toast_enregistre", langue), "success");
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
      <EnteteEcran
        titre={type === "creance" ? t("nouvelle_creance_titre", langue) : t("nouvelle_dette_titre", langue)}
        onRetour={() => router.back()}
      />

      <View style={styles.ligneChoix}>
        <Pressable
          onPress={() => setType("creance")}
          style={[styles.choix, { borderColor: type === "creance" ? colors.accent : colors.border, borderWidth: type === "creance" ? 2 : 1 }]}
        >
          <Text style={{ color: type === "creance" ? colors.accent : colors.textPrimary, fontSize: 13 }}>
            {t("nouvelle_creance_type_creance", langue)}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setType("dette")}
          style={[styles.choix, { borderColor: type === "dette" ? colors.accent : colors.border, borderWidth: type === "dette" ? 2 : 1 }]}
        >
          <Text style={{ color: type === "dette" ? colors.accent : colors.textPrimary, fontSize: 13 }}>
            {t("nouvelle_creance_type_dette", langue)}
          </Text>
        </Pressable>
      </View>

      <Champ label={t("nouvelle_creance_personne", langue)} valeur={personne} onChange={setPersonne} placeholder={t("nouvelle_creance_personne_placeholder", langue)} />
      <Text style={[styles.label, { color: colors.textSecondary }]}>{t("nouvelle_creance_telephone", langue)}</Text>
      <View style={styles.ligneNumero}>
        <Pressable onPress={() => router.push("/pays")} style={[styles.indicatif, { borderColor: colors.border }]}>
          <Text style={{ fontSize: 14 }}>{pays.drapeau} {pays.indicatif}</Text>
          <Feather name="chevron-down" size={12} color={colors.textMuted} />
        </Pressable>
        <TextInput
          value={telephone}
          onChangeText={setTelephone}
          placeholder="6XX XXX XXX"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          style={[styles.inputNumero, { borderColor: colors.border, color: colors.textPrimary }]}
        />
      </View>
      <Champ label={t("nouvelle_creance_montant", langue)} valeur={montant} onChange={setMontant} placeholder="5000" numerique />
      <Text style={[styles.label, { color: colors.textSecondary }]}>{t("nouvelle_creance_echeance", langue)}</Text>
      <Pressable onPress={() => setAfficherDatePicker(true)} style={[styles.selecteurDate, { borderColor: colors.border }]}>
        <Text style={{ color: echeance ? colors.textPrimary : colors.textMuted, fontSize: 14 }}>{echeance || "AAAA-MM-JJ"}</Text>
        <Feather name="calendar" size={15} color={colors.textMuted} />
      </Pressable>
      {afficherDatePicker && (
        <DateTimePicker
          value={echeance ? new Date(echeance) : new Date()}
          mode="date"
          onChange={(event: any, date?: Date) => {
            setAfficherDatePicker(false);
            if (event.type === "set" && date) setEcheance(formaterDateSeule(date));
          }}
        />
      )}

      <Text style={[styles.label, { color: colors.textSecondary, marginTop: 8 }]}>{t("produit_champ_facultatif", langue)}</Text>
      <View style={styles.ligneChamps}>
        {CHAMPS_SUGGERES.map((c) => (
          <Pressable
            key={c.cle}
            onPress={() => basculerChamp(c.cle)}
            style={[styles.pucheChamp, { borderColor: champsActifs.includes(c.cle) ? colors.accent : colors.border, borderWidth: champsActifs.includes(c.cle) ? 2 : 1 }]}
          >
            <Feather name={champsActifs.includes(c.cle) ? "check" : "plus"} size={12} color={champsActifs.includes(c.cle) ? colors.accent : colors.textMuted} />
            <Text style={{ color: champsActifs.includes(c.cle) ? colors.accent : colors.textPrimary, fontSize: 12 }}>{t(c.labelCle as any, langue)}</Text>
          </Pressable>
        ))}
      </View>

      {champsActifs.map((cle) => {
        const info = CHAMPS_SUGGERES.find((c) => c.cle === cle)!;
        if (cle === "produit") {
          return (
            <View key={cle} style={{ marginBottom: 14 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t(info.labelCle as any, langue)}</Text>
              <Pressable onPress={ouvrirSelecteurProduit} style={[styles.selecteurProduit, { borderColor: colors.border }]}>
                <Text style={{ color: produitsSelectionnes.length > 0 ? colors.textPrimary : colors.textMuted, fontSize: 14, flex: 1 }} numberOfLines={1}>
                  {produitsSelectionnes.length > 0 ? produitsSelectionnes.join(", ") : t("achats_choisir_produit", langue)}
                </Text>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          );
        }
        return (
          <Champ
            key={cle}
            label={t(info.labelCle as any, langue)}
            valeur={valeursChamps[cle] ?? ""}
            onChange={(v: string) => setValeursChamps((p) => ({ ...p, [cle]: v }))}
            placeholder=""
          />
        );
      })}

      <Modal visible={selecteurProduitOuvert} transparent animationType="slide">
        <Pressable style={styles.fondModal} onPress={() => setSelecteurProduitOuvert(false)}>
          <View style={[styles.feuilleModal, { backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "600", marginBottom: 10 }}>{t("nouvelle_creance_champ_produit", langue)}</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {produits.map((p) => {
                const selectionne = produitsSelectionnes.includes(p.nom);
                return (
                  <Pressable key={p.id} onPress={() => basculerProduit(p.nom)} style={[styles.ligneProduit, { borderBottomColor: colors.border }]}>
                    <Feather name={selectionne ? "check-square" : "square"} size={16} color={selectionne ? colors.accent : colors.textMuted} />
                    <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{p.nom}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable onPress={() => setSelecteurProduitOuvert(false)} style={[styles.boutonValider, { backgroundColor: colors.accent }]}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{t("popup_ok", langue)}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>

      <View style={{ padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }}>
        <Pressable
          onPress={sauvegarder}
          disabled={chargement}
          style={[styles.boutonSauver, { backgroundColor: colors.accent, opacity: chargement ? 0.6 : 1 }]}
        >
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
            {chargement ? "..." : t("nouvelle_creance_sauver", langue)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Champ({ label, valeur, onChange, placeholder, numerique }: any) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        value={valeur}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={numerique ? "numeric" : "default"}
        style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 50 },
  label: { fontSize: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  ligneNumero: { flexDirection: "row", gap: 8, marginBottom: 14 },
  indicatif: { justifyContent: "center", paddingHorizontal: 10, borderWidth: 1, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  inputNumero: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  selecteurDate: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  ligneChoix: { flexDirection: "row", gap: 8, marginBottom: 16 },
  choix: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  ligneChamps: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  pucheChamp: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  boutonSauver: { paddingVertical: 14, borderRadius: 8, alignItems: "center" },
  selecteurProduit: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11 },
  fondModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  feuilleModal: { maxHeight: "70%", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  ligneProduit: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  boutonValider: { paddingVertical: 13, borderRadius: 8, alignItems: "center", marginTop: 12 },
});