import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, BackHandler, Easing, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, TextInput } from "@/components/Texte";
import { Apparition, PressableAnime } from "@/components/anim";
import { SelecteurProduit } from "@/components/SelecteurProduit";
import { ombre } from "@/components/UI";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency/CurrencyProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { obtenirUserId } from "@/lib/auth/userCache";
import { peutEcrire } from "@/lib/trial/gate";
import { afficherPaywall } from "@/lib/trial/paywall";
import { CATEGORIES_DEPENSES, libelleCategorieDepense } from "@/lib/depenses/categories";
import { listerCreancesOuvertes, CreanceOuverte } from "@/lib/creances/enregistrerPaiement";
import { lireScanEnCours, viderScanEnCours } from "@/lib/scanner/scanEnCours";
import { preparerLignes } from "@/lib/scanner/preparerLignes";
import { chargerCatalogue } from "@/lib/scanner/candidats";
import { ProduitCandidat, decisionMatch } from "@/lib/scanner/matching";
import { devinerCategorieDepense } from "@/lib/scanner/categories";
import { enregistrerScan, rejeterScan } from "@/lib/scanner/enregistrerScan";
import { creerProduitRapide } from "@/lib/scanner/creerProduitRapide";
import { DocumentType, ExtractedDocument, LigneScannee } from "@/lib/scanner/types";

// Écran de VALIDATION d'un document scanné (ou d'une vente dictée) : c'est le
// seul endroit où l'opération est confirmée. L'IA a lu le document ; ici
// l'utilisateur vérifie, corrige, associe les produits, puis enregistre. Aucun
// enregistrement automatique, aucune création de produit sans confirmation.

type LigneEdit = { cle: string; ligne: LigneScannee; idAuto: string | null; qte: string; prix: string };
type DepenseEdit = { cle: string; description: string; categorie: string; montant: string };

const TYPES: { id: DocumentType; icone: keyof typeof Feather.glyphMap; cle: string }[] = [
  { id: "sale", icone: "shopping-cart", cle: "val_type_sale" },
  { id: "purchase", icone: "truck", cle: "val_type_purchase" },
  { id: "expense", icone: "credit-card", cle: "val_type_expense" },
  { id: "payment", icone: "repeat", cle: "val_type_payment" },
];

let compteurCle = 0;
const nouvelleCle = () => `l${++compteurCle}`;
const num = (s: string): number => {
  const n = parseFloat(String(s).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// Date lue par l'IA (ISO, « 12/03/2026 »…) → Date valide, sinon aujourd'hui.
function lireDate(brut?: string | null): Date {
  if (!brut) return new Date();
  const fr = brut.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  const d = fr ? new Date(Number(fr[3].length === 2 ? "20" + fr[3] : fr[3]), Number(fr[2]) - 1, Number(fr[1])) : new Date(brut);
  const an = d.getFullYear();
  if (isNaN(d.getTime()) || an < 2000 || an > new Date().getFullYear() + 1) return new Date();
  return d;
}

function typeInitial(doc: ExtractedDocument, source?: string): DocumentType {
  if (doc.documentType !== "unknown") return doc.documentType;
  if (source === "vocal") return "sale";
  return doc.items.length > 0 ? "purchase" : "expense";
}

export default function ValidationScan() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { formater } = useCurrency();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const scan = useMemo(() => lireScanEnCours(), []);
  const document = scan?.document;

  const [userId, setUserId] = useState<string | null>(null);
  const [catalogue, setCatalogue] = useState<ProduitCandidat[]>([]);
  const [lignes, setLignes] = useState<LigneEdit[]>([]);
  const [pret, setPret] = useState(false);
  const [type, setType] = useState<DocumentType>(document ? typeInitial(document, scan?.source) : "sale");
  const [date, setDate] = useState<Date>(lireDate(document?.date));
  const [afficherDate, setAfficherDate] = useState(false);
  const [nom, setNom] = useState(document?.customerName ?? document?.supplierName ?? "");
  const [reste, setReste] = useState(document?.remainingAmount ? String(document.remainingAmount) : "");
  const [totalFacture, setTotalFacture] = useState(document?.total != null ? String(document.total) : "");
  const [depenses, setDepenses] = useState<DepenseEdit[]>(() =>
    (document?.expenses ?? []).map((e) => ({
      cle: nouvelleCle(),
      description: e.rawDescription,
      categorie: devinerCategorieDepense(e.category ?? e.rawDescription, langue) ?? "autre",
      montant: e.amount != null ? String(e.amount) : "",
    }))
  );
  const [sens, setSens] = useState<"creance" | "dette">("creance");
  const [creances, setCreances] = useState<CreanceOuverte[]>([]);
  const [creanceId, setCreanceId] = useState<string | null>(null);
  const [montantPaiement, setMontantPaiement] = useState(document ? String(document.paidAmount ?? document.total ?? "") : "");
  const [indexPicker, setIndexPicker] = useState<number | null>(null);
  const [apercuOuvert, setApercuOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [succes, setSucces] = useState(false);

  // Garde : écran ouvert sans document (rechargement) → retour.
  useEffect(() => {
    if (!scan) router.back();
  }, [scan]);

  // Chargement local : catalogue + matching (aucun appel réseau).
  useEffect(() => {
    if (!document) return;
    (async () => {
      const id = await obtenirUserId();
      setUserId(id);
      if (!id) return setPret(true);
      const [cat, prepares] = await Promise.all([chargerCatalogue(id), preparerLignes(id, document)]);
      setCatalogue(cat);
      setLignes(
        prepares.map((l) => ({
          cle: nouvelleCle(),
          ligne: l,
          idAuto: l.produitIdChoisi,
          qte: String(l.quantity ?? 1),
          prix: String(l.unitPrice ?? (l.totalPrice != null && l.quantity ? l.totalPrice / l.quantity : l.totalPrice ?? "")),
        }))
      );
      setPret(true);
    })();
  }, [document]);

  // Paiement : créances/dettes ouvertes correspondant au nom.
  useEffect(() => {
    if (type !== "payment" || !userId) return;
    listerCreancesOuvertes(userId, sens, nom).then((l) => {
      setCreances(l);
      setCreanceId((prec) => (prec && l.some((c) => c.id === prec) ? prec : l.length === 1 ? l[0].id : null));
    });
  }, [type, sens, nom, userId]);

  // Le bouton retour matériel demande confirmation avant d'abandonner.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      demanderAbandon();
      return true;
    });
    return () => sub.remove();
  });

  const lignesActives = lignes.filter((l) => !l.ligne.ignoree);
  const totalCalcule =
    type === "expense"
      ? depenses.reduce((s, d) => s + num(d.montant), 0)
      : lignesActives.reduce((s, l) => s + num(l.qte) * num(l.prix), 0);
  const ecart =
    document?.total != null && type !== "expense" && type !== "payment" && Math.abs(totalCalcule - document.total) > Math.max(1, document.total * 0.01);

  function majLigne(cle: string, patch: Partial<LigneEdit> | ((l: LigneEdit) => Partial<LigneEdit>)) {
    setLignes((prev) => prev.map((l) => (l.cle === cle ? { ...l, ...(typeof patch === "function" ? patch(l) : patch) } : l)));
  }

  function choisirProduit(cle: string, produitId: string | null) {
    const produit = produitId ? catalogue.find((p) => p.id === produitId) : null;
    majLigne(cle, (l) => ({
      ligne: {
        ...l.ligne,
        rawName: l.ligne.rawName || produit?.nom || "",
        produitIdChoisi: produitId,
        match: { ...l.ligne.match, productId: produitId, matchedName: produit?.nom ?? null },
      },
      // Vente : le prix du catalogue complète un prix non lu.
      prix: !num(l.prix) && type === "sale" && produit?.prixVente ? String(produit.prixVente) : l.prix,
    }));
    setIndexPicker(null);
  }

  function creerEtChoisir(cle: string, nomProduit: string) {
    const l = lignes.find((x) => x.cle === cle);
    Alert.alert(t("val_creer_titre", langue), `« ${nomProduit} »\n${t("val_creer_texte", langue)}`, [
      { text: t("val_annuler", langue), style: "cancel" },
      {
        text: t("val_creer_oui", langue),
        onPress: async () => {
          if (!userId) return;
          const produit = await creerProduitRapide({ userId, nom: nomProduit, prixVente: num(l?.prix ?? "") || null });
          setCatalogue((c) => [{ id: produit.id, nom: produit.nom, prixVente: produit.prixVente, reference: null }, ...c]);
          setLignes((prev) =>
            prev.map((x) =>
              x.cle === cle
                ? { ...x, ligne: { ...x.ligne, produitIdChoisi: produit.id, match: { ...x.ligne.match, productId: produit.id, matchedName: produit.nom } } }
                : x
            )
          );
          setIndexPicker(null);
        },
      },
    ]);
  }

  function ajouterLigne() {
    const cle = nouvelleCle();
    setLignes((prev) => [
      ...prev,
      {
        cle,
        idAuto: null,
        qte: "1",
        prix: "",
        ligne: { rawName: "", quantity: 1, match: { productId: null, rawName: "", matchedName: null, score: 0, method: "none", candidats: [] }, produitIdChoisi: null, ignoree: false },
      },
    ]);
    setIndexPicker(lignes.length);
  }

  function demanderAbandon() {
    Alert.alert(t("val_abandon_titre", langue), t("val_abandon_texte", langue), [
      { text: t("val_continuer_edition", langue), style: "cancel" },
      {
        text: t("val_abandonner", langue),
        style: "destructive",
        onPress: async () => {
          if (userId && document) await rejeterScan(userId, document, lignes.map((l) => l.ligne)).catch(() => {});
          viderScanEnCours();
          router.back();
        },
      },
    ]);
  }

  async function enregistrer() {
    if (!document || !userId || enCours) return;

    if (!(await peutEcrire())) {
      afficherPaywall(langue, () => router.push("/premium"));
      return;
    }

    const restantNum = num(reste);
    const lignesFinales: LigneScannee[] = lignesActives
      .filter((l) => (l.ligne.rawName.trim() || l.ligne.produitIdChoisi) && num(l.qte) > 0)
      .map((l) => ({
        ...l.ligne,
        quantity: num(l.qte),
        unitPrice: num(l.prix),
        totalPrice: num(l.qte) * num(l.prix),
      }));
    const depensesFinales = depenses.filter((d) => num(d.montant) > 0);

    if ((type === "sale" || type === "purchase") && lignesFinales.length === 0) return showToast(t("val_rien", langue), "error");
    if (type === "expense" && depensesFinales.length === 0) return showToast(t("val_rien", langue), "error");
    if (type === "payment" && (!creanceId || num(montantPaiement) <= 0)) return showToast(t("val_paiement_choisir", langue), "error");
    if (type === "sale" && restantNum > 0 && !nom.trim()) return showToast(t("val_client_requis", langue), "error");

    const totalEdite = type === "purchase" ? num(totalFacture) || totalCalcule : totalCalcule || (document.total ?? 0);
    const docEdite: ExtractedDocument = {
      ...document,
      documentType: type,
      date: date.toISOString(),
      customerName: type === "sale" ? nom.trim() || null : document.customerName,
      supplierName: type === "purchase" ? nom.trim() || null : document.supplierName,
      total: totalEdite,
      remainingAmount: restantNum > 0 && (type === "sale" || type === "purchase") ? restantNum : null,
      paidAmount: type === "payment" ? num(montantPaiement) : document.paidAmount,
      items: lignesFinales,
      expenses: depensesFinales.map((d) => ({ rawDescription: d.description || libelleCategorieDepense(d.categorie, langue), category: d.categorie, amount: num(d.montant) })),
    };

    setEnCours(true);
    try {
      const resultat = await enregistrerScan({
        userId,
        document: docEdite,
        documentOriginal: document,
        typeChoisi: type,
        lignes: lignesFinales,
        date,
        clientNom: type === "sale" ? nom.trim() || undefined : undefined,
        fournisseurNom: type === "purchase" ? nom.trim() || undefined : undefined,
        creanceId: type === "payment" ? creanceId ?? undefined : undefined,
        scanId: scan?.scanId,
        source: scan?.source === "vocal" ? "vocal" : "scan_facture",
        langue,
      });
      if (resultat === "doublon") return showToast(t("val_doublon", langue), "error");
      if (resultat === "rien_a_enregistrer") return showToast(t("val_rien", langue), "error");
      setSucces(true);
    } catch {
      showToast(t("val_erreur", langue), "error");
    } finally {
      setEnCours(false);
    }
  }

  function terminer() {
    viderScanEnCours();
    const destination = { sale: "/(tabs)/ventes", purchase: "/achats", expense: "/depenses", payment: "/creances", unknown: "/(tabs)/accueil" }[type];
    router.dismissAll?.();
    router.replace(destination as any);
  }

  if (!document) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const estLigneProduit = type === "sale" || type === "purchase";
  const etiquetteNom = type === "purchase" ? t("val_fournisseur", langue) : t("val_client", langue);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* En-tête */}
      <View style={[styles.entete, { paddingTop: insets.top + 8, backgroundColor: colors.background }]}>
        <Pressable onPress={demanderAbandon} hitSlop={10} style={[styles.rond, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Feather name="x" size={18} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 19, fontWeight: "800", letterSpacing: -0.3 }}>{t("val_titre", langue)}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{scan?.source === "vocal" ? t("val_source_vocal", langue) : t("val_source_scan", langue)}</Text>
        </View>
        {scan?.imageUri ? (
          <Pressable onPress={() => setApercuOuvert(true)}>
            <Image source={{ uri: scan.imageUri }} style={[styles.miniature, { borderColor: colors.border }]} />
          </Pressable>
        ) : null}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Apparition>
            <View style={[styles.note, { backgroundColor: colors.accentBg }]}>
              <Feather name="shield" size={14} color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "600", flex: 1 }}>{t("val_ia_note", langue)}</Text>
            </View>
          </Apparition>

          {/* Type d'opération */}
          <Apparition delai={60}>
            <Text style={[styles.etiquette, { color: colors.textMuted }]}>{t("val_type", langue)}</Text>
            <View style={styles.ligneTypes}>
              {TYPES.map((tp) => {
                const actif = tp.id === type;
                return (
                  <PressableAnime
                    key={tp.id}
                    onPress={() => setType(tp.id)}
                    echelle={0.95}
                    style={[styles.puceType, { backgroundColor: actif ? colors.accent : colors.surface, borderColor: actif ? colors.accent : colors.border }]}
                  >
                    <Feather name={tp.icone} size={15} color={actif ? "#fff" : colors.textSecondary} />
                    <Text style={{ color: actif ? "#fff" : colors.textPrimary, fontSize: 12.5, fontWeight: "700" }}>{t(tp.cle as any, langue)}</Text>
                  </PressableAnime>
                );
              })}
            </View>
          </Apparition>

          {/* Infos générales */}
          <Apparition delai={110}>
            <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border }, ombre(colors, 1)]}>
              {type !== "expense" && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.etiquette, { color: colors.textMuted }]}>{type === "payment" ? t("val_client", langue) + " / " + t("val_fournisseur", langue) : etiquetteNom}</Text>
                  <TextInput value={nom} onChangeText={setNom} placeholder="—" placeholderTextColor={colors.textMuted} style={[styles.champ, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.background }]} />
                </View>
              )}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.etiquette, { color: colors.textMuted }]}>{t("val_date", langue)}</Text>
                  <Pressable onPress={() => setAfficherDate(true)} style={[styles.champ, styles.champDate, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{date.toLocaleDateString(langue === "fr" ? "fr-FR" : "en-GB")}</Text>
                    <Feather name="calendar" size={15} color={colors.textMuted} />
                  </Pressable>
                </View>
                {document.invoiceNumber ? (
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.etiquette, { color: colors.textMuted }]}>{t("val_facture_no", langue)}</Text>
                    <View style={[styles.champ, { borderColor: colors.border, backgroundColor: colors.background, justifyContent: "center" }]}>
                      <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 14 }}>{document.invoiceNumber}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
              {afficherDate && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  maximumDate={new Date()}
                  onChange={(e: any, d?: Date) => {
                    setAfficherDate(false);
                    if (e.type === "set" && d) setDate(d);
                  }}
                />
              )}
            </View>
          </Apparition>

          {/* Lignes produits */}
          {estLigneProduit && (
            <View style={{ gap: 10 }}>
              <Text style={[styles.etiquette, { color: colors.textMuted }]}>{t("val_lignes", langue)} ({lignesActives.length})</Text>
              {!pret && <Text style={{ color: colors.textMuted }}>…</Text>}
              {pret && lignes.length === 0 && <Text style={{ color: colors.textMuted, textAlign: "center", paddingVertical: 14 }}>{t("val_aucune_ligne", langue)}</Text>}
              {lignes.map((l, i) => {
                const ign = l.ligne.ignoree;
                let etat: { texte: string; fg: string; bg: string };
                if (l.ligne.produitIdChoisi === null) etat = { texte: t("val_conf_basse", langue), fg: colors.danger, bg: colors.dangerBg };
                else if (l.ligne.produitIdChoisi !== l.idAuto) etat = { texte: t("val_conf_manuel", langue), fg: colors.info, bg: colors.infoBg };
                else {
                  const d = decisionMatch(l.ligne.match.score);
                  etat = d === "auto" ? { texte: t("val_conf_haute", langue), fg: colors.success, bg: colors.successBg } : { texte: t("val_conf_moyenne", langue), fg: colors.warning, bg: colors.warningBg };
                }
                const nomProduit = l.ligne.match.matchedName;
                return (
                  <Apparition key={l.cle} delai={150 + Math.min(i, 6) * 60}>
                    <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border, opacity: ign ? 0.45 : 1 }, ombre(colors, 1)]}>
                      <View style={styles.enteteLigne}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.etiquette, { color: colors.textMuted, marginBottom: 2 }]}>{t("val_lu", langue)}</Text>
                          <Text numberOfLines={2} style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "700" }}>{l.ligne.rawName || "—"}</Text>
                        </View>
                        {!ign && (
                          <View style={[styles.etat, { backgroundColor: etat.bg }]}>
                            <Text style={{ color: etat.fg, fontSize: 11, fontWeight: "700" }}>{etat.texte}</Text>
                          </View>
                        )}
                        <Pressable onPress={() => majLigne(l.cle, { ligne: { ...l.ligne, ignoree: !ign } })} hitSlop={8} style={{ marginLeft: 8 }}>
                          <Feather name={ign ? "rotate-ccw" : "trash-2"} size={17} color={ign ? colors.accent : colors.textMuted} />
                        </Pressable>
                      </View>

                      {!ign && (
                        <>
                          <Pressable onPress={() => setIndexPicker(i)} style={[styles.selecteur, { borderColor: nomProduit ? colors.accent : colors.border, backgroundColor: nomProduit ? colors.accentBg : colors.background }]}>
                            <Feather name="package" size={16} color={nomProduit ? colors.accent : colors.textMuted} />
                            <Text numberOfLines={1} style={{ flex: 1, color: nomProduit ? colors.textPrimary : colors.textMuted, fontSize: 14, fontWeight: nomProduit ? "700" : "500" }}>
                              {nomProduit ?? t("val_choisir_produit", langue)}
                            </Text>
                            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "700" }}>{nomProduit ? t("val_changer", langue) : ""}</Text>
                            <Feather name="chevron-right" size={16} color={colors.textMuted} />
                          </Pressable>

                          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.etiquette, { color: colors.textMuted }]}>{t("val_quantite", langue)}</Text>
                              <TextInput value={l.qte} onChangeText={(v) => majLigne(l.cle, { qte: v })} keyboardType="decimal-pad" style={[styles.champ, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.background }]} />
                            </View>
                            <View style={{ flex: 1.4 }}>
                              <Text style={[styles.etiquette, { color: colors.textMuted }]}>{t("val_prix_unitaire", langue)}</Text>
                              <TextInput value={l.prix} onChangeText={(v) => majLigne(l.cle, { prix: v })} keyboardType="decimal-pad" style={[styles.champ, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.background }]} />
                            </View>
                          </View>
                          <Text style={{ color: colors.textSecondary, fontSize: 12.5, fontWeight: "700", textAlign: "right", marginTop: 8 }}>
                            {t("val_total_ligne", langue)} : {formater(num(l.qte) * num(l.prix))}
                          </Text>
                        </>
                      )}
                    </View>
                  </Apparition>
                );
              })}
              <PressableAnime onPress={ajouterLigne} style={[styles.boutonAjout, { borderColor: colors.accent }]}>
                <Feather name="plus" size={16} color={colors.accent} />
                <Text style={{ color: colors.accent, fontSize: 14, fontWeight: "700" }}>{t("val_ajouter_ligne", langue)}</Text>
              </PressableAnime>
            </View>
          )}

          {/* Dépenses */}
          {type === "expense" && (
            <View style={{ gap: 10 }}>
              <Text style={[styles.etiquette, { color: colors.textMuted }]}>{t("val_depenses", langue)}</Text>
              {depenses.length === 0 && <Text style={{ color: colors.textMuted, textAlign: "center", paddingVertical: 14 }}>{t("val_aucune_ligne", langue)}</Text>}
              {depenses.map((d) => (
                <View key={d.cle} style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border }, ombre(colors, 1)]}>
                  <Text style={[styles.etiquette, { color: colors.textMuted }]}>{t("val_description", langue)}</Text>
                  <TextInput value={d.description} onChangeText={(v) => setDepenses((p) => p.map((x) => (x.cle === d.cle ? { ...x, description: v } : x)))} style={[styles.champ, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.background }]} />
                  <Text style={[styles.etiquette, { color: colors.textMuted, marginTop: 10 }]}>{t("val_categorie", langue)}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {CATEGORIES_DEPENSES.map((c) => {
                      const actif = d.categorie === c;
                      return (
                        <Pressable key={c} onPress={() => setDepenses((p) => p.map((x) => (x.cle === d.cle ? { ...x, categorie: c } : x)))} style={[styles.puceCat, { backgroundColor: actif ? colors.accent : colors.background, borderColor: actif ? colors.accent : colors.border }]}>
                          <Text style={{ color: actif ? "#fff" : colors.textPrimary, fontSize: 12, fontWeight: "600" }}>{libelleCategorieDepense(c, langue)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={[styles.etiquette, { color: colors.textMuted, marginTop: 10 }]}>{t("val_montant", langue)}</Text>
                  <TextInput value={d.montant} onChangeText={(v) => setDepenses((p) => p.map((x) => (x.cle === d.cle ? { ...x, montant: v } : x)))} keyboardType="decimal-pad" style={[styles.champ, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.background }]} />
                </View>
              ))}
              <PressableAnime
                onPress={() => setDepenses((p) => [...p, { cle: nouvelleCle(), description: "", categorie: "autre", montant: "" }])}
                style={[styles.boutonAjout, { borderColor: colors.accent }]}
              >
                <Feather name="plus" size={16} color={colors.accent} />
                <Text style={{ color: colors.accent, fontSize: 14, fontWeight: "700" }}>{t("val_ajouter_ligne", langue)}</Text>
              </PressableAnime>
            </View>
          )}

          {/* Paiement d'une créance / dette */}
          {type === "payment" && (
            <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border, gap: 10 }, ombre(colors, 1)]}>
              <Text style={[styles.etiquette, { color: colors.textMuted }]}>{t("val_paiement_sens", langue)}</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["creance", "dette"] as const).map((s) => (
                  <Pressable key={s} onPress={() => setSens(s)} style={[styles.puceType, { flex: 1, justifyContent: "center", backgroundColor: sens === s ? colors.accent : colors.background, borderColor: sens === s ? colors.accent : colors.border }]}>
                    <Text style={{ color: sens === s ? "#fff" : colors.textPrimary, fontSize: 12.5, fontWeight: "700" }}>{t(s === "creance" ? "val_paiement_recu" : "val_paiement_emis", langue)}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.etiquette, { color: colors.textMuted, marginTop: 4 }]}>{t("val_paiement_titre", langue)}</Text>
              {creances.length === 0 && <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("val_paiement_aucune", langue)}</Text>}
              {creances.map((c) => {
                const actif = c.id === creanceId;
                return (
                  <Pressable key={c.id} onPress={() => setCreanceId(c.id)} style={[styles.selecteur, { borderColor: actif ? colors.accent : colors.border, backgroundColor: actif ? colors.accentBg : colors.background }]}>
                    <Feather name={actif ? "check-circle" : "circle"} size={17} color={actif ? colors.accent : colors.textMuted} />
                    <Text numberOfLines={1} style={{ flex: 1, color: colors.textPrimary, fontSize: 14, fontWeight: "600" }}>{c.personneNom}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12.5 }}>{t("val_restant", langue)} {formater(c.montantRestant)}</Text>
                  </Pressable>
                );
              })}
              <Text style={[styles.etiquette, { color: colors.textMuted }]}>{t("val_montant", langue)}</Text>
              <TextInput value={montantPaiement} onChangeText={setMontantPaiement} keyboardType="decimal-pad" style={[styles.champ, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.background }]} />
            </View>
          )}

          {/* Totaux + crédit */}
          {(type === "sale" || type === "purchase" || type === "expense") && (
            <Apparition delai={200}>
              <View style={[styles.carte, { backgroundColor: colors.surface, borderColor: colors.border }, ombre(colors, 1)]}>
                <View style={styles.ligneTotal}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13.5 }}>{t("val_total_calcule", langue)}</Text>
                  <Text style={{ color: colors.textPrimary, fontSize: 19, fontWeight: "800" }}>{formater(totalCalcule)}</Text>
                </View>
                {document.total != null && type !== "expense" && (
                  <View style={styles.ligneTotal}>
                    <Text style={{ color: colors.textMuted, fontSize: 12.5 }}>{t("val_total_document", langue)}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: "600" }}>{formater(document.total)}</Text>
                  </View>
                )}
                {ecart && (
                  <View style={[styles.note, { backgroundColor: colors.warningBg, marginTop: 10 }]}>
                    <Feather name="alert-triangle" size={14} color={colors.warning} />
                    <Text style={{ color: colors.warning, fontSize: 12, fontWeight: "600", flex: 1 }}>{t("val_ecart", langue)}</Text>
                  </View>
                )}
                {type === "purchase" && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={[styles.etiquette, { color: colors.textMuted }]}>{t("val_total_facture", langue)}</Text>
                    <TextInput value={totalFacture} onChangeText={setTotalFacture} placeholder={String(totalCalcule)} placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" style={[styles.champ, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.background }]} />
                  </View>
                )}
                {(type === "sale" || type === "purchase") && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={[styles.etiquette, { color: colors.textMuted }]}>{t("val_reste", langue)}</Text>
                    <TextInput value={reste} onChangeText={setReste} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textMuted} style={[styles.champ, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.background }]} />
                    <Text style={{ color: colors.textMuted, fontSize: 11.5, marginTop: 4 }}>{t("val_reste_aide", langue)}</Text>
                  </View>
                )}
              </View>
            </Apparition>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Barre d'actions */}
      <View style={[styles.barre, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        <Pressable onPress={demanderAbandon} style={[styles.boutonAnnuler, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.textPrimary, fontSize: 14.5, fontWeight: "700" }}>{t("val_annuler", langue)}</Text>
        </Pressable>
        <PressableAnime onPress={enregistrer} disabled={enCours || !pret} style={{ flex: 1.6, opacity: enCours || !pret ? 0.6 : 1 }}>
          <LinearGradient colors={[colors.accentClair, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.boutonOk}>
            <Feather name="check" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 15.5, fontWeight: "800" }}>{enCours ? "…" : t("val_enregistrer", langue)}</Text>
          </LinearGradient>
        </PressableAnime>
      </View>

      {/* Sélecteur de produit */}
      {indexPicker != null && lignes[indexPicker] && (
        <SelecteurProduit
          visible
          libelleLu={lignes[indexPicker].ligne.rawName}
          catalogue={catalogue}
          suggestions={lignes[indexPicker].ligne.match.candidats}
          produitActuel={lignes[indexPicker].ligne.produitIdChoisi}
          onFermer={() => setIndexPicker(null)}
          onChoisir={(id) => choisirProduit(lignes[indexPicker].cle, id)}
          onCreer={(n) => creerEtChoisir(lignes[indexPicker].cle, n)}
        />
      )}

      {/* Aperçu de l'image */}
      <Modal visible={apercuOuvert} transparent animationType="fade" onRequestClose={() => setApercuOuvert(false)}>
        <Pressable style={styles.apercuFond} onPress={() => setApercuOuvert(false)}>
          {scan?.imageUri ? <Image source={{ uri: scan.imageUri }} style={{ width: "92%", height: "80%" }} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>

      {succes && <SuccesOverlay libelle={t("val_enregistre", langue)} onFin={terminer} />}
    </View>
  );
}

// Coche animée plein écran à la fin d'un enregistrement réussi.
function SuccesOverlay({ libelle, onFin }: { libelle: string; onFin: () => void }) {
  const { colors } = useTheme();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 14 }),
      Animated.delay(650),
    ]).start(() => onFin());
  }, [v, onFin]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.succesFond, { backgroundColor: colors.background, opacity: v.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: "clamp" }) }]}>
      <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }}>
        <LinearGradient colors={[colors.accentClair, colors.accent]} style={styles.succesRond}>
          <Feather name="check" size={54} color="#fff" />
        </LinearGradient>
      </Animated.View>
      <Animated.Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "800", marginTop: 22, opacity: v }}>{libelle}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  rond: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  miniature: { width: 40, height: 52, borderRadius: 8, borderWidth: 1 },
  note: { flexDirection: "row", alignItems: "center", gap: 8, padding: 11, borderRadius: 12 },
  etiquette: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 },
  ligneTypes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  puceType: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  puceCat: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12, borderWidth: 1 },
  carte: { borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: 18, padding: 14 },
  champ: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  champDate: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  enteteLigne: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  etat: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  selecteur: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  boutonAjout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderStyle: "dashed", borderRadius: 14, paddingVertical: 13 },
  ligneTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  barre: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  boutonAnnuler: { flex: 1, height: 54, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  boutonOk: { height: 54, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  apercuFond: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", alignItems: "center", justifyContent: "center" },
  succesFond: { alignItems: "center", justifyContent: "center", zIndex: 99 },
  succesRond: { width: 112, height: 112, borderRadius: 56, alignItems: "center", justifyContent: "center" },
});
