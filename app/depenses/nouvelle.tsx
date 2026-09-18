import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { useLangue, t } from "@/lib/i18n";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { EnteteEcran } from "@/components/UI";
import { obtenirUserId } from "@/lib/auth/userCache";
import { synchroniserPourUtilisateurCourant } from "@/lib/database/sync";
import { enregistrerActivite } from "@/lib/audit/journal";
import { peutEcrire } from "@/lib/trial/gate";
import { afficherPaywall } from "@/lib/trial/paywall";
import { CATEGORIES_DEPENSES, libelleCategorieDepense } from "@/lib/depenses/categories";

type Option = { id: string; nom: string };
type ChampPerso = { nom: string; valeur: string };

export default function NouvelleDepense() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { showToast } = useToast();
  const [categorie, setCategorie] = useState("loyer");
  const [categoriePerso, setCategoriePerso] = useState("");
  const [saisieCategorie, setSaisieCategorie] = useState(false);
  const [categoriesPerso, setCategoriesPerso] = useState<string[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Option[]>([]);
  const [produits, setProduits] = useState<Option[]>([]);
  const [fournisseurId, setFournisseurId] = useState<string | null>(null);
  const [produitId, setProduitId] = useState<string | null>(null);
  const [champs, setChamps] = useState<ChampPerso[]>([]);
  const [description, setDescription] = useState("");
  const [montant, setMontant] = useState("");
  const [chargement, setChargement] = useState(false);

  // Charge les catégories déjà utilisées (personnalisées), les fournisseurs et
  // les produits pour les sélecteurs — tout en local, fonctionne hors ligne.
  useEffect(() => {
    (async () => {
      const userId = await obtenirUserId();
      if (!userId) return;
      const [deps, fourns, prods] = await Promise.all([
        database.get("depenses").query(Q.where("user_id", userId)).fetch(),
        database.get("fournisseurs").query(Q.where("user_id", userId)).fetch(),
        database.get("produits").query(Q.where("user_id", userId)).fetch(),
      ]);
      const customs = new Set<string>();
      for (const d of deps as any[]) {
        if (d.categorie && !CATEGORIES_DEPENSES.includes(d.categorie)) customs.add(d.categorie);
      }
      setCategoriesPerso([...customs]);
      setFournisseurs((fourns as any[]).map((f) => ({ id: f.id, nom: f.nom })));
      setProduits((prods as any[]).map((p) => ({ id: p.id, nom: p.nom })));
    })();
  }, []);

  function choisirNouvelleCategorie() {
    const nom = categoriePerso.trim();
    if (!nom) return;
    setCategoriesPerso((actuel) => (actuel.includes(nom) ? actuel : [...actuel, nom]));
    setCategorie(nom);
    setCategoriePerso("");
    setSaisieCategorie(false);
  }

  function majChamp(index: number, patch: Partial<ChampPerso>) {
    setChamps((actuel) => actuel.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  async function sauvegarder() {
    if (chargement) return;
    if (!(await peutEcrire())) {
      afficherPaywall(langue, () => router.push("/premium"));
      return;
    }
    if (!montant) {
      showToast(t("nouvelle_creance_erreur", langue), "error");
      return;
    }
    setChargement(true);
    const userId = await obtenirUserId();
    if (!userId) { setChargement(false); return; }

    const fournisseur = fournisseurs.find((f) => f.id === fournisseurId) ?? null;
    const produit = produits.find((p) => p.id === produitId) ?? null;
    // Champs personnalisés : uniquement ceux avec un nom ET une valeur.
    const champsValides = champs.filter((c) => c.nom.trim() && c.valeur.trim());
    const donnees: Record<string, unknown> = {};
    if (fournisseur) { donnees.fournisseur_id = fournisseur.id; donnees.fournisseur_nom = fournisseur.nom; }
    if (produit) { donnees.produit_id = produit.id; donnees.produit_nom = produit.nom; }
    if (champsValides.length > 0) {
      donnees.champs = Object.fromEntries(champsValides.map((c) => [c.nom.trim(), c.valeur.trim()]));
    }

    await database.write(async () => {
      await database.get("depenses").create((d: any) => {
        d.userId = userId;
        d.categorie = categorie;
        d.description = description.trim() || null;
        d.montant = Number(montant);
        d.donneesSupplementairesJson = JSON.stringify(donnees);
        d.creeLe = new Date();
        d.synchronise = false;
      });
    });

    synchroniserPourUtilisateurCourant().catch(() => {});
    await enregistrerActivite("depense", "ajout", "Nouvelle dépense");
    setChargement(false);
    showToast(t("toast_enregistre", langue), "success");
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <EnteteEcran titre={t("depenses_ajouter", langue)} onRetour={() => router.back()} />

      {/* Catégorie : prédéfinies + personnalisées + création manuelle */}
      <Text style={styles.label}>{t("depenses_categorie", langue)}</Text>
      <View style={styles.ligneCategories}>
        {[...CATEGORIES_DEPENSES, ...categoriesPerso].map((c) => (
          <Pressable
            key={c}
            onPress={() => { setCategorie(c); setSaisieCategorie(false); }}
            style={[styles.puce, { borderColor: categorie === c ? colors.accent : colors.border, borderWidth: categorie === c ? 2 : 1 }]}
          >
            <Text style={{ color: categorie === c ? colors.accent : colors.textPrimary, fontSize: 12 }}>{libelleCategorieDepense(c, langue)}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setSaisieCategorie(true)}
          style={[styles.puce, { borderColor: saisieCategorie ? colors.accent : colors.border, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 4 }]}
        >
          <Feather name="plus" size={12} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t("depense_categorie_nouvelle", langue)}</Text>
        </Pressable>
      </View>
      {saisieCategorie && (
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          <TextInput
            value={categoriePerso}
            onChangeText={setCategoriePerso}
            placeholder={t("depense_categorie_nom", langue)}
            placeholderTextColor={colors.textMuted}
            autoFocus
            onSubmitEditing={choisirNouvelleCategorie}
            style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.textPrimary, marginBottom: 0 }]}
          />
          <Pressable onPress={choisirNouvelleCategorie} style={[styles.boutonAjouter, { backgroundColor: colors.accent }]}>
            <Feather name="check" size={16} color="#fff" />
          </Pressable>
        </View>
      )}

      <Champ label={t("depenses_montant", langue)} valeur={montant} onChange={setMontant} numerique colors={colors} />

      {/* Lien fournisseur : sélection directe au lieu d'une saisie libre */}
      {fournisseurs.length > 0 && (
        <>
          <Text style={styles.label}>{t("depense_fournisseur", langue)}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => setFournisseurId(null)} style={[styles.puce, { borderColor: fournisseurId === null ? colors.accent : colors.border, borderWidth: fournisseurId === null ? 2 : 1 }]}>
                <Text style={{ color: fournisseurId === null ? colors.accent : colors.textPrimary, fontSize: 12 }}>{t("depense_aucun", langue)}</Text>
              </Pressable>
              {fournisseurs.map((f) => (
                <Pressable key={f.id} onPress={() => setFournisseurId(f.id)} style={[styles.puce, { borderColor: fournisseurId === f.id ? colors.accent : colors.border, borderWidth: fournisseurId === f.id ? 2 : 1 }]}>
                  <Text style={{ color: fournisseurId === f.id ? colors.accent : colors.textPrimary, fontSize: 12 }}>{f.nom}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </>
      )}

      {/* Lien produit : sélection directe */}
      {produits.length > 0 && (
        <>
          <Text style={styles.label}>{t("depense_produit_concerne", langue)}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => setProduitId(null)} style={[styles.puce, { borderColor: produitId === null ? colors.accent : colors.border, borderWidth: produitId === null ? 2 : 1 }]}>
                <Text style={{ color: produitId === null ? colors.accent : colors.textPrimary, fontSize: 12 }}>{t("depense_aucun", langue)}</Text>
              </Pressable>
              {produits.map((p) => (
                <Pressable key={p.id} onPress={() => setProduitId(p.id)} style={[styles.puce, { borderColor: produitId === p.id ? colors.accent : colors.border, borderWidth: produitId === p.id ? 2 : 1 }]}>
                  <Text style={{ color: produitId === p.id ? colors.accent : colors.textPrimary, fontSize: 12 }}>{p.nom}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </>
      )}

      <Champ label={t("depenses_description", langue)} valeur={description} onChange={setDescription} colors={colors} />

      {/* Champs personnalisés : nom + valeur, ajoutables/supprimables */}
      <Text style={styles.label}>{t("champs_personnalises", langue)}</Text>
      {champs.map((c, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 8, alignItems: "center" }}>
          <TextInput
            value={c.nom}
            onChangeText={(v) => majChamp(i, { nom: v })}
            placeholder={t("champ_nom", langue)}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.textPrimary, marginBottom: 0 }]}
          />
          <TextInput
            value={c.valeur}
            onChangeText={(v) => majChamp(i, { valeur: v })}
            placeholder={t("champ_valeur", langue)}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.textPrimary, marginBottom: 0 }]}
          />
          <Pressable onPress={() => setChamps((actuel) => actuel.filter((_, idx) => idx !== i))} hitSlop={8}>
            <Feather name="x" size={16} color={colors.danger} />
          </Pressable>
        </View>
      ))}
      <Pressable
        onPress={() => setChamps((actuel) => [...actuel, { nom: "", valeur: "" }])}
        style={[styles.puce, { borderColor: colors.border, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginBottom: 16 }]}
      >
        <Feather name="plus" size={12} color={colors.accent} />
        <Text style={{ color: colors.accent, fontSize: 12 }}>{t("champ_ajouter", langue)}</Text>
      </Pressable>
    </ScrollView>

      <View style={{ padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }}>
        <Pressable onPress={sauvegarder} disabled={chargement} style={[styles.bouton, { backgroundColor: colors.accent, opacity: chargement ? 0.6 : 1 }]}>
          <Feather name="check" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{chargement ? "..." : t("nouvelle_creance_sauver", langue)}</Text>
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
  ligneCategories: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  puce: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, marginBottom: 14 },
  boutonAjouter: { width: 44, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  bouton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 10, marginTop: 10 },
});
