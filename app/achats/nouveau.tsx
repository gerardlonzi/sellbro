import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Modal } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { useLangue, t } from "@/lib/i18n";
import DateTimePicker from "@react-native-community/datetimepicker";
import { formaterDateSeule } from "@/lib/formatDate";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { enregistrerMouvementStock } from "@/lib/stock/mouvements";
import { EnteteEcran } from "@/components/UI";
import { obtenirUserId } from "@/lib/auth/userCache";
import { synchroniserPourUtilisateurCourant } from "@/lib/database/sync";
import { enregistrerActivite } from "@/lib/audit/journal";
import { peutEcrire } from "@/lib/trial/gate";
import { afficherPaywall } from "@/lib/trial/paywall";
import { usePays } from "@/lib/pays/PaysProvider";
import { validerTelephone } from "@/lib/pays/validation";

type Produit = { id: string; nom: string };
type FournisseurOption = { id: string; nom: string; telephone: string | null };

export default function NouvelAchat() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { showToast } = useToast();
  const { pays } = usePays();
  const [fournisseur, setFournisseur] = useState("");
  const [fournisseurs, setFournisseurs] = useState<FournisseurOption[]>([]);
  const [selecteurFournisseurOuvert, setSelecteurFournisseurOuvert] = useState(false);
  const [aCredit, setACredit] = useState(false);
  const [echeance, setEcheance] = useState("");
  const [afficherDatePicker, setAfficherDatePicker] = useState(false);
  const [description, setDescription] = useState("");
  const [montant, setMontant] = useState("");
  const [produitId, setProduitId] = useState<string | null>(null);
  const [nomProduitLie, setNomProduitLie] = useState("");
  const [quantiteRecue, setQuantiteRecue] = useState("");
  const [chargement, setChargement] = useState(false);
  const [selecteurOuvert, setSelecteurOuvert] = useState(false);
  const [produits, setProduits] = useState<Produit[]>([]);

  async function ouvrirSelecteur() {
    const userId = await obtenirUserId();
    if (!userId) return;
        const resultats = await database.get("produits").query(Q.where("user_id", userId)).fetch();
    setProduits((resultats as any[]).map((p) => ({ id: p.id, nom: p.nom })));
    setSelecteurOuvert(true);
  }

  function choisirProduit(p: Produit) {
    setProduitId(p.id);
    setNomProduitLie(p.nom);
    setSelecteurOuvert(false);
  }

  const [nouveauFournisseurNom, setNouveauFournisseurNom] = useState("");
  const [nouveauFournisseurTel, setNouveauFournisseurTel] = useState("");
  const [creationFournisseur, setCreationFournisseur] = useState(false);

  // Ouvre le sélecteur de fournisseurs : la liste existante est chargée, et on
  // peut créer un nouveau fournisseur (nom + téléphone) depuis ce modal.
  async function ouvrirSelecteurFournisseur() {
    const userId = await obtenirUserId();
    if (!userId) return;
    const resultats = await database.get("fournisseurs").query(Q.where("user_id", userId)).fetch();
    setFournisseurs((resultats as any[]).map((f) => ({ id: f.id, nom: f.nom, telephone: f.telephone ?? null })));
    setNouveauFournisseurNom("");
    setNouveauFournisseurTel("");
    setSelecteurFournisseurOuvert(true);
  }

  // Crée un VRAI fournisseur (il apparaîtra dans la page Fournisseurs) avec le
  // téléphone — nécessaire pour les relances et la dette en cas de crédit.
  async function creerFournisseur() {
    const nomNet = nouveauFournisseurNom.trim();
    if (!nomNet) {
      showToast(t("fournisseurs_erreur_nom", langue), "error");
      return;
    }
    if (nouveauFournisseurTel.trim()) {
      const validation = validerTelephone(nouveauFournisseurTel.trim(), pays);
      if (!validation.valide) {
        showToast(validation.message ?? t("inscription_verifie_numero", langue), "error");
        return;
      }
    }
    setCreationFournisseur(true);
    try {
      const userId = await obtenirUserId();
      if (!userId) return;
      const telephoneComplet = nouveauFournisseurTel.trim() ? `${pays.indicatif}${nouveauFournisseurTel.replace(/\s/g, "")}` : null;
      let cree: any = null;
      await database.write(async () => {
        cree = await database.get("fournisseurs").create((f: any) => {
          f.userId = userId;
          f.nom = nomNet;
          f.telephone = telephoneComplet;
          f.adresse = null;
          f.totalAchats = 0;
          f.montantDu = 0;
          f.donneesSupplementairesJson = "{}";
          f.creeLe = new Date();
          f.synchronise = false;
        });
      });
      await enregistrerActivite("fournisseur", "ajout", `Fournisseur ajouté : ${nomNet}`);
      synchroniserPourUtilisateurCourant().catch(() => {});
      // Ajoute à la liste locale et sélectionne ce fournisseur.
      setFournisseurs((actuels) => [...actuels, { id: cree.id, nom: nomNet, telephone: telephoneComplet }]);
      setFournisseur(nomNet);
      setSelecteurFournisseurOuvert(false);
    } finally {
      setCreationFournisseur(false);
    }
  }

  async function sauvegarder() {
    if (chargement) return;
    if (!(await peutEcrire())) {
      afficherPaywall(langue, () => router.push("/premium"));
      return;
    }
    if (!montant) {
      showToast(t("achats_erreur_montant", langue), "error");
      return;
    }
    // Un achat à crédit sans fournisseur nommé serait introuvable dans les
    // créances : on exige le nom du fournisseur dans ce cas.
    if (aCredit && !fournisseur.trim()) {
      showToast(t("achats_credit_fournisseur_requis", langue), "error");
      return;
    }
    setChargement(true);
    const userId = await obtenirUserId();
    if (!userId) return;

    // Le fournisseur choisi dans la liste fournit son téléphone pour la dette.
    const fournisseurChoisi = fournisseurs.find((f) => f.nom === fournisseur.trim()) ?? null;

    await database.write(async () => {
      await database.get("achats").create((a: any) => {
        a.userId = userId;
        a.fournisseurNom = fournisseur.trim() || null;
        a.description = description.trim() || null;
        a.montant = Number(montant);
        a.source = "manuel";
        a.donneesSupplementairesJson = "{}";
        a.creeLe = new Date();
        a.synchronise = false;
      });

      // Achat à crédit → on crée la DETTE correspondante (visible dans
      // Créances & dettes, côté « Tu dois »).
      if (aCredit) {
        await database.get("creances_dettes").create((c: any) => {
          c.userId = userId;
          c.type = "dette";
          c.personneNom = fournisseur.trim();
          c.telephone = fournisseurChoisi?.telephone ?? null;
          c.montantInitial = Number(montant);
          c.montantRestant = Number(montant);
          c.dateEcheance = echeance || null;
          c.statut = "en_cours";
          c.note = description.trim() || null;
          c.produitConcerne = nomProduitLie || null;
          c.creeLe = new Date();
          c.synchronise = false;
        });
      }
    });

    // Si l'achat est lié à un produit du stock, on augmente le stock automatiquement.
    if (produitId && quantiteRecue) {
      await enregistrerMouvementStock({
        userId: userId,
        produitId,
        type: "achat",
        quantite: Number(quantiteRecue),
        raison: fournisseur.trim() ? `Réassort — ${fournisseur.trim()}` : "Réassort",
      });
    }

    synchroniserPourUtilisateurCourant().catch(() => {});
    const libelleAchat = quantiteRecue && nomProduitLie
      ? `Achat enregistré : ${quantiteRecue} × ${nomProduitLie}`
      : `Achat enregistré : ${description.trim() || fournisseur.trim() || "—"}`;
    await enregistrerActivite("achat", "ajout", libelleAchat);
    setChargement(false);
    showToast(t("toast_enregistre", langue), "success");
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
      <EnteteEcran titre={t("achats_titre", langue)} onRetour={() => router.back()} />

      {/* Fournisseur : sélection dans la liste existante via un sélecteur,
          plutôt qu'une saisie libre (les achats restent rattachés au même nom). */}
      <Text style={styles.label}>{t("achats_fournisseur", langue)}</Text>
      <Pressable onPress={ouvrirSelecteurFournisseur} style={[styles.selecteur, { borderColor: colors.border }]}>
        <Text style={{ color: fournisseur ? colors.textPrimary : colors.textMuted, fontSize: 14 }}>
          {fournisseur || t("achats_choisir_fournisseur", langue)}
        </Text>
        <Feather name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>

      <Champ label={t("achats_description", langue)} valeur={description} onChange={setDescription} colors={colors} />
      <Champ label={t("achats_montant", langue)} valeur={montant} onChange={setMontant} numerique colors={colors} />

      {/* Achat à crédit : la dette est enregistrée dans Créances & dettes. */}
      <Pressable onPress={() => setACredit((v) => !v)} style={styles.ligneCredit}>
        <Feather name={aCredit ? "check-square" : "square"} size={18} color={aCredit ? colors.accent : colors.textMuted} />
        <Text style={{ color: colors.textPrimary, fontSize: 13, flex: 1 }}>{t("achats_a_credit", langue)}</Text>
      </Pressable>

      {aCredit && (
        <>
          <Text style={styles.label}>{t("nouvelle_creance_echeance", langue)}</Text>
          <Pressable onPress={() => setAfficherDatePicker(true)} style={[styles.selecteur, { borderColor: colors.border }]}>
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
        </>
      )}

      <Text style={styles.label}>{t("achats_lier_produit", langue)}</Text>
      <Pressable onPress={ouvrirSelecteur} style={[styles.selecteur, { borderColor: colors.border }]}>
        <Text style={{ color: nomProduitLie ? colors.textPrimary : colors.textMuted, fontSize: 14 }}>
          {nomProduitLie || t("achats_choisir_produit", langue)}
        </Text>
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </Pressable>

      {produitId && (
        <Champ label={t("achats_quantite_recue", langue)} valeur={quantiteRecue} onChange={setQuantiteRecue} numerique colors={colors} />
      )}

      <Modal visible={selecteurOuvert} transparent animationType="slide">
        <Pressable style={styles.fondModal} onPress={() => setSelecteurOuvert(false)}>
          <Pressable style={[styles.feuille, { backgroundColor: colors.surface }]} onPress={() => {}}>
            {/* État vide : pas de produit en stock → message + raccourci vers
                la page d'ajout, au lieu d'une liste vide muette. */}
            {produits.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 20 }}>
                <Feather name="package" size={28} color={colors.textMuted} />
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 10, textAlign: "center" }}>
                  {t("stock_aucun_resultat", langue)}
                </Text>
                <Pressable
                  onPress={() => { setSelecteurOuvert(false); router.push("/produit/nouveau"); }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}
                >
                  <Feather name="plus" size={14} color="#fff" />
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>{t("stock_ajouter_produit", langue)}</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView>
                {produits.map((p) => (
                  <Pressable key={p.id} onPress={() => choisirProduit(p)} style={[styles.ligneChoix, { borderBottomColor: colors.border }]}>
                    <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{p.nom}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Sélecteur de fournisseur : liste existante + saisie libre d'un
          nouveau nom (les deux sont possibles). */}
      <Modal visible={selecteurFournisseurOuvert} transparent animationType="slide">
        <Pressable style={styles.fondModal} onPress={() => setSelecteurFournisseurOuvert(false)}>
          <Pressable style={[styles.feuille, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <ScrollView style={{ maxHeight: 300 }}>
              {fournisseurs.length === 0 && (
                <Text style={{ color: colors.textMuted, fontSize: 13, paddingVertical: 10, textAlign: "center" }}>
                  {t("fournisseurs_vide", langue)}
                </Text>
              )}
              {fournisseurs.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => { setFournisseur(f.nom); setSelecteurFournisseurOuvert(false); }}
                  style={[styles.ligneChoix, { borderBottomColor: colors.border }]}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{f.nom}</Text>
                  {fournisseur === f.nom && <Feather name="check" size={16} color={colors.accent} />}
                </Pressable>
              ))}
            </ScrollView>
            {/* Nouveau fournisseur : nom + téléphone, créé pour de bon (il
                apparaîtra dans la page Fournisseurs). */}
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 12, marginBottom: 6 }}>
              {t("achats_nouveau_fournisseur", langue)}
            </Text>
            <TextInput
              value={nouveauFournisseurNom}
              onChangeText={setNouveauFournisseurNom}
              placeholder={t("fournisseurs_nom", langue)}
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, marginBottom: 8 }]}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={nouveauFournisseurTel}
                onChangeText={setNouveauFournisseurTel}
                placeholder={t("fournisseurs_telephone", langue)}
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.textPrimary, marginBottom: 0 }]}
              />
              <Pressable
                onPress={creerFournisseur}
                disabled={creationFournisseur}
                style={[styles.boutonAjouter, { backgroundColor: colors.accent, opacity: creationFournisseur ? 0.6 : 1 }]}
              >
                <Feather name="check" size={16} color="#fff" />
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>

      <View style={{ padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }}>
        <Pressable onPress={sauvegarder} disabled={chargement} style={[styles.bouton, { backgroundColor: colors.accent, opacity: chargement ? 0.6 : 1 }]}>
          <Feather name="check" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{chargement ? "..." : t("achats_enregistrer", langue)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Champ({ label, valeur, onChange, numerique, colors }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={valeur}
        onChangeText={onChange}
        keyboardType={numerique ? "numeric" : "default"}
        style={{ borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 50 },
  label: { fontSize: 12, marginBottom: 8, color: "#888" },
  selecteur: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 14 },
  ligneCredit: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  boutonAjouter: { width: 44, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, marginBottom: 14 },
  bouton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 10, marginTop: 10 },
  fondModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  feuille: { maxHeight: "60%", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  ligneChoix: { paddingVertical: 12, borderBottomWidth: 1 },
});