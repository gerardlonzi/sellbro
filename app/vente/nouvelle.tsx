import { useState, useRef } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Modal, Linking, KeyboardAvoidingView, Platform } from "react-native";
import { router } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { useLangue, t } from "@/lib/i18n";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { EnteteEcran } from "@/components/UI";
import { AvatarNom } from "@/components/AvatarNom";
import { enregistrerMouvementStock } from "@/lib/stock/mouvements";
import { obtenirUserId } from "@/lib/auth/userCache";
import { synchroniserPourUtilisateurCourant } from "@/lib/database/sync";
import { enregistrerActivite } from "@/lib/audit/journal";
import { creerFactureDepuisVentes } from "@/lib/factures/creerFacture";
import DateTimePicker from "@react-native-community/datetimepicker";
import { peutEcrire } from "@/lib/trial/gate";
import { afficherPaywall } from "@/lib/trial/paywall";
import { formaterDateSeule } from "@/lib/formatDate";
import { genererRecuPdf } from "@/lib/export/genererPdf";
import { versionDonnees } from "@/lib/dataVersion";
import { usePays } from "@/lib/pays/PaysProvider";
import { validerTelephone } from "@/lib/pays/validation";
import { useCurrency } from "@/lib/currency/CurrencyProvider";

type Produit = { id: string; nom: string; prixVente: number; quantiteStock: number; imageUri: string | null };
type LigneVente = { produitId: string | null; nom: string; quantite: number; prixUnitaire: number; imageUri: string | null };
type Client = { nom: string; telephone: string | null };

export default function NouvelleVente() {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const { showToast } = useToast();
  const { pays } = usePays();
  const { formater } = useCurrency();
  const [panier, setPanier] = useState<LigneVente[]>([]);
  const [client, setClient] = useState("");
  const [clientTelephone, setClientTelephone] = useState("");
  const [modePaiement, setModePaiement] = useState<"cash" | "momo" | "credit">("cash");
  const [dateEcheance, setDateEcheance] = useState("");
  const [afficherDateEcheance, setAfficherDateEcheance] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [selecteurProduitOuvert, setSelecteurProduitOuvert] = useState(false);
  const [selecteurClientOuvert, setSelecteurClientOuvert] = useState(false);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectionProduits, setSelectionProduits] = useState<Set<string>>(new Set());
  const [scannerOuvert, setScannerOuvert] = useState(false);
  const [verrouilleScan, setVerrouilleScan] = useState(false);
  const [resultatScan, setResultatScan] = useState<{ type: "trouve"; produit: Produit & { reference: string } } | { type: "introuvable"; reference: string } | null>(null);
  const [catalogue, setCatalogue] = useState<(Produit & { reference: string | null })[]>([]);
  const [quantitesBrouillon, setQuantitesBrouillon] = useState<Record<number, string>>({});
  const [rechercheProduit, setRechercheProduit] = useState("");
  // Fenêtre « Envoyer le reçu » après enregistrement : nom facultatif,
  // numéro obligatoire (c'est lui qui porte le message WhatsApp).
  const [modalRecuOuvert, setModalRecuOuvert] = useState(false);
  const [recuNom, setRecuNom] = useState("");
  const [recuTelephone, setRecuTelephone] = useState("");
  const [recuPanier, setRecuPanier] = useState<{ nom: string; quantite: number; prixUnitaire: number }[]>([]);
  const [recuTotal, setRecuTotal] = useState(0);
  const [permissionCamera, demanderPermissionCamera] = useCameraPermissions();

  // Extrait la 1re image d'un produit (champsSupplementaires.images est un
  // tableau JSON d'URI ; on accepte aussi l'ancienne clé « image_uri »).
  function imageDeProduit(p: any): string | null {
    const supp = p.champsSupplementaires ?? {};
    if (supp.images) {
      try { return JSON.parse(supp.images)[0] ?? null; } catch { return null; }
    }
    return supp.image_uri ?? null;
  }

  // Les produits du sélecteur sont gardés en mémoire : ils ne sont rechargés
  // que si les données ont changé (versionDonnees) — avant, chaque ouverture
  // du sélecteur relançait une requête complète, même sans modification.
  const versionProduits = useRef<number | null>(null);

  async function ouvrirSelecteurProduit() {
    setSelectionProduits(new Set());
    setRechercheProduit("");
    setSelecteurProduitOuvert(true);

    if (versionProduits.current !== null && versionDonnees() === versionProduits.current) return;
    versionProduits.current = versionDonnees();

    const userId = await obtenirUserId();
    if (!userId) return;
    const resultats = await database.get("produits").query(Q.where("user_id", userId)).fetch();
    setProduits((resultats as any[]).map((p) => ({ id: p.id, nom: p.nom, prixVente: p.prixVente, quantiteStock: p.quantiteStock, imageUri: imageDeProduit(p) })));
  }

  function ajouterAuPanier(p: Produit) {
    setPanier((actuel) => {
      const existant = actuel.find((l) => l.produitId === p.id);
      if (existant) {
        return actuel.map((l) => (l.produitId === p.id ? { ...l, quantite: l.quantite + 1 } : l));
      }
      return [...actuel, { produitId: p.id, nom: p.nom, quantite: 1, prixUnitaire: p.prixVente, imageUri: p.imageUri }];
    });
  }

  function basculerSelectionProduit(id: string) {
    setSelectionProduits((actuel) => {
      const copie = new Set(actuel);
      if (copie.has(id)) copie.delete(id);
      else copie.add(id);
      return copie;
    });
  }

  function confirmerSelection() {
    produits.filter((p) => selectionProduits.has(p.id)).forEach((p) => ajouterAuPanier(p));
    setSelectionProduits(new Set());
    setSelecteurProduitOuvert(false);
  }

  // Charge le catalogue (avec la référence = code-barres) puis ouvre le scanner.
  async function ouvrirScanner() {
    const userId = await obtenirUserId();
    if (!userId) return;
    const resultats = await database.get("produits").query(Q.where("user_id", userId)).fetch();
    setCatalogue((resultats as any[]).map((p) => ({
      id: p.id, nom: p.nom, prixVente: p.prixVente, quantiteStock: p.quantiteStock,
      reference: p.champsSupplementaires?.reference ?? null,
      imageUri: imageDeProduit(p),
    })));
    setScannerOuvert(true);
  }

  function surBarcodeScanne({ data }: { data: string }) {
    if (verrouilleScan || resultatScan) return;
    setVerrouilleScan(true);

    const produit = catalogue.find((p) => p.reference === data);
    if (produit) {
      setResultatScan({ type: "trouve", produit: produit as Produit & { reference: string } });
    } else {
      setResultatScan({ type: "introuvable", reference: data });
    }
  }

  function ajouterResultatAuPanier() {
    if (resultatScan?.type === "trouve") {
      ajouterAuPanier(resultatScan.produit);
    }
    setResultatScan(null);
    setVerrouilleScan(false);
  }

  function reanalyser() {
    setResultatScan(null);
    setVerrouilleScan(false);
  }

  function quitterScanner() {
    setScannerOuvert(false);
    setResultatScan(null);
    setVerrouilleScan(false);
  }

  function modifierQuantite(index: number, delta: number) {
    const ligne = panier[index];
    // Bouton « − » à 1 : on notifie au lieu de baisser silencieusement.
    if (delta < 0 && ligne.quantite <= 1) {
      showToast(t("vente_quantite_minimum", langue), "error");
      return;
    }
    if (delta > 0 && ligne.produitId) {
      const produit = produits.find((p) => p.id === ligne.produitId);
      if (produit && ligne.quantite >= produit.quantiteStock) {
        showToast(t("vente_rupture_stock", langue), "error");
        return;
      }
    }
    setPanier((actuel) =>
      actuel.map((l, i) => (i === index ? { ...l, quantite: Math.max(1, l.quantite + delta) } : l))
    );
  }

  // Saisie manuelle de la quantité (clavier), en complément des boutons +/-.
  // On utilise un « brouillon » local pour permettre d'effacer puis retaper,
  // et on notifie immédiatement si la valeur saisie est inférieure à 1.
  function modifierQuantiteManuelle(index: number, valeur: string) {
    setQuantitesBrouillon((prev) => ({ ...prev, [index]: valeur }));
    if (valeur.trim() !== "") {
      const n = parseInt(valeur, 10);
      if (!isNaN(n) && n < 1) {
        showToast(t("vente_quantite_minimum", langue), "error");
      }
    }
  }

  function validerQuantiteManuelle(index: number) {
    const brouillon = quantitesBrouillon[index];
    setQuantitesBrouillon((prev) => {
      const copie = { ...prev };
      delete copie[index];
      return copie;
    });
    if (brouillon == null) return;
    const n = parseInt(brouillon, 10);
    if (isNaN(n)) return;
    if (n < 1) {
      showToast(t("vente_quantite_minimum", langue), "error");
      return;
    }
    setPanier((actuel) =>
      actuel.map((l, i) => (i === index ? { ...l, quantite: n } : l))
    );
  }

  function retirerDuPanier(index: number) {
    setPanier((actuel) => actuel.filter((_, i) => i !== index));
  }

  async function ouvrirSelecteurClient() {
    const userId = await obtenirUserId();
    if (!userId) return;
    const ventes = await database.get("ventes").query(Q.where("user_id", userId)).fetch();
    const nomsVus = new Map<string, Client>();
    (ventes as any[]).forEach((v) => {
      if (v.clientNom && !nomsVus.has(v.clientNom)) nomsVus.set(v.clientNom, { nom: v.clientNom, telephone: v.clientTelephone });
    });
    setClients(Array.from(nomsVus.values()));
    setSelecteurClientOuvert(true);
  }

  function importerClient(c: Client) {
    setClient(c.nom);
    setClientTelephone(c.telephone ?? "");
    setSelecteurClientOuvert(false);
  }

  const total = panier.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);

  async function sauvegarder(genererFacture = false) {
    if (chargement) return;
    if (!(await peutEcrire())) {
      afficherPaywall(langue, () => router.push("/premium"));
      return;
    }
    if (panier.length === 0) {
      showToast(t("vente_panier_vide", langue), "error");
      return;
    }

    // La quantité d'aucun produit ne doit être inférieure à 1.
    if (panier.some((l) => l.quantite < 1)) {
      showToast(t("vente_quantite_minimum", langue), "error");
      return;
    }

    if (modePaiement === "credit" && !client.trim()) {
      showToast(t("vente_credit_nom_requis", langue), "error");
      return;
    }

    if (clientTelephone.trim()) {
      const validation = validerTelephone(clientTelephone.trim(), pays);
      if (!validation.valide) {
        showToast(validation.message ?? t("inscription_verifie_numero", langue), "error");
        return;
      }
    }

    setChargement(true);
    const userId = await obtenirUserId();
    if (!userId) { setChargement(false); return; }

    const venteIds: string[] = [];
    // Identifiant de « transaction » commun à toutes les lignes du panier :
    // permet de compter les VENTES (transactions) séparément des UNITÉS vendues.
    const transactionId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await database.write(async () => {
      for (const ligne of panier) {
        const vente = await database.get("ventes").create((v: any) => {
          v.userId = userId;
          v.produitId = ligne.produitId;
          v.produitNom = ligne.nom;
          v.quantite = ligne.quantite;
          v.prixUnitaire = ligne.prixUnitaire;
          v.clientNom = client.trim() || null;
          v.clientTelephone = clientTelephone.trim() ? `${pays.indicatif}${clientTelephone.replace(/\s/g, "")}` : null;
          v.modePaiement = modePaiement;
          v.source = "manuel";
          v.donneesSupplementairesJson = JSON.stringify({ transactionId });
          v.creeLe = new Date();
          v.synchronise = false;
        });
        venteIds.push(vente.id);
      }

      // Paiement à crédit → on crée la créance correspondante.
      if (modePaiement === "credit") {
        const totalVente = panier.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
        await database.get("creances_dettes").create((c: any) => {
          c.userId = userId;
          c.type = "creance";
          c.personneNom = client.trim();
          c.telephone = clientTelephone.trim() ? `${pays.indicatif}${clientTelephone.replace(/\s/g, "")}` : null;
          c.montantInitial = totalVente;
          c.montantRestant = totalVente;
          c.dateEcheance = dateEcheance || null;
          c.statut = "en_cours";
          c.note = null;
          c.produitConcerne = null;
          c.creeLe = new Date();
          c.synchronise = false;
        });
      }
    });

    // Déduit le stock APRÈS l'écriture des ventes (transaction séparée,
    // car enregistrerMouvementStock a sa propre database.write).
    for (const ligne of panier) {
      if (ligne.produitId) {
        await enregistrerMouvementStock({
          userId: userId,
          produitId: ligne.produitId,
          type: "vente",
          quantite: -ligne.quantite,
          raison: "Vente",
        });
      }
    }

    synchroniserPourUtilisateurCourant().catch(() => {});
    await enregistrerActivite("vente", "ajout", `Vente enregistrée : ${panier.map((l) => `${l.quantite} × ${l.nom}`).join(", ")}`);

    // Génération de facture : on regroupe les ventes en une facture puis on
    // ouvre son écran (où se trouve le bouton Imprimer direct).
    if (genererFacture && venteIds.length > 0) {
      const factureId = await creerFactureDepuisVentes(userId, venteIds);
      setChargement(false);
      router.replace(`/factures/${factureId}`);
      return;
    }

    setChargement(false);
    // Après l'enregistrement : proposer d'envoyer le reçu au client. La fenêtre
    // demande le nom (facultatif) et le numéro (obligatoire pour l'envoi).
    setRecuPanier(panier.map((l) => ({ nom: l.nom, quantite: l.quantite, prixUnitaire: l.prixUnitaire })));
    setRecuTotal(total);
    setRecuNom(client.trim());
    setRecuTelephone(clientTelephone.trim());
    setModalRecuOuvert(true);
  }

  // Envoi du reçu : le numéro est obligatoire ici (le client doit pouvoir
  // recevoir le message). Le nom reste facultatif.
  async function envoyerRecu() {
    const validation = validerTelephone(recuTelephone.trim(), pays);
    if (!validation.valide) {
      showToast(validation.message ?? t("inscription_verifie_numero", langue), "error");
      return;
    }
    const telephoneComplet = `${pays.indicatif}${recuTelephone.replace(/\s/g, "")}`;
    await genererRecuPdf(
      recuNom.trim() || null,
      telephoneComplet,
      recuPanier,
      recuTotal,
      langue
    );
    // Ouvre la conversation WhatsApp du client : le PDF partagé s'y joint.
    const numero = telephoneComplet.replace(/[^0-9]/g, "");
    await Linking.openURL(`https://wa.me/${numero}?text=${encodeURIComponent(t("recu_whatsapp_message", langue))}`).catch(() => {});
    setModalRecuOuvert(false);
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
      <EnteteEcran titre={t("vente_nouvelle_titre", langue)} onRetour={() => router.back()} />

      {panier.length === 0 && (
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 10, textAlign:"center",marginTop:5 }}>
          {t("vente_pas_de_produit", langue)}
        </Text>
      )}
      {panier.map((ligne, i) => (
        // Carte par article : image du produit, nom + prix unitaire, stepper de
        // quantité centré, total de ligne à droite. Plus lisible qu'une ligne
        // dense — le geste principal (ajuster la quantité) est au centre.
        <View key={i} style={[styles.cartePanier, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable onPress={() => retirerDuPanier(i)} hitSlop={10} style={styles.boutonRetirerLigne}>
            <Feather name="x" size={13} color={colors.textMuted} />
          </Pressable>

          <View style={styles.lignePanierHaut}>
            <AvatarNom nom={ligne.nom} imageUri={ligne.imageUri} taille={44} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "600" }}>{ligne.nom}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{formater(ligne.prixUnitaire)}</Text>
            </View>
            <Text style={{ color: colors.accent, fontSize: 15, fontWeight: "700" }}>
              {formater(ligne.quantite * ligne.prixUnitaire)}
            </Text>
          </View>

          {/* Stepper de quantité : la quantité au milieu, en grand. */}
          <View style={[styles.stepper, { backgroundColor: colors.background }]}>
            <Pressable onPress={() => modifierQuantite(i, -1)} style={[styles.boutonStepper, { borderColor: colors.border }]}>
              <Feather name="minus" size={18} color={colors.textPrimary} />
            </Pressable>
            <TextInput
              value={quantitesBrouillon[i] ?? String(ligne.quantite)}
              onChangeText={(v) => modifierQuantiteManuelle(i, v)}
              onEndEditing={() => validerQuantiteManuelle(i)}
              onBlur={() => validerQuantiteManuelle(i)}
              keyboardType="numeric"
              style={{ width: 56, textAlign: "center", color: colors.textPrimary, fontSize: 18, fontWeight: "700" }}
            />
            <Pressable onPress={() => modifierQuantite(i, 1)} style={[styles.boutonStepper, { borderColor: colors.border }]}>
              <Feather name="plus" size={18} color={colors.textPrimary} />
            </Pressable>
          </View>
        </View>
      ))}

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable onPress={ouvrirSelecteurProduit} style={[styles.boutonAjouterProduit, { borderColor: colors.accent, flex: 1 }]}>
          <Feather name="plus" size={15} color={colors.accent} />
          <Text style={{ color: colors.accent, fontSize: 13 }}>{t("vente_ajouter_produit", langue)}</Text>
        </Pressable>
        <Pressable onPress={ouvrirScanner} style={[styles.boutonAjouterProduit, { borderColor: colors.accent, flex: 1 }]}>
          <MaterialCommunityIcons name="barcode-scan" size={15} color={colors.accent} />
          <Text style={{ color: colors.accent, fontSize: 13 }}>{t("vente_scanner", langue)}</Text>
        </Pressable>
      </View>

      {panier.length > 0 && (
        <View style={[styles.bandeauTotal, { backgroundColor: colors.accentBg }]}>
          <Text style={{ color: colors.accent, fontSize: 14, fontWeight: "600" }}>{t("vente_total", langue)} : {formater(total)}</Text>
        </View>
      )}

      <Text style={styles.label}>{t("vente_client_facultatif", langue)}</Text>
      <View style={styles.ligneChampBouton}>
        <TextInput
          value={client}
          onChangeText={setClient}
          placeholder={t("vente_nom_client", langue)}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.textPrimary }]}
        />
        <Pressable onPress={ouvrirSelecteurClient} style={[styles.boutonImporter, { backgroundColor: colors.accentBg }]}>
          <Feather name="users" size={15} color={colors.accent} />
        </Pressable>
      </View>

      <View style={[styles.ligneNumero, { marginBottom: 14 }]}>
        <Pressable onPress={() => router.push("/pays")} style={[styles.indicatif, { borderColor: colors.border }]}>
          <Text style={{ fontSize: 14, color: colors.textPrimary }}>{pays.drapeau} {pays.indicatif}</Text>
          <Feather name="chevron-down" size={12} color={colors.textMuted} />
        </Pressable>
        <TextInput
          value={clientTelephone}
          onChangeText={setClientTelephone}
          placeholder={t("vente_client_telephone", langue)}
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.textPrimary }]}
        />
      </View>
      {modePaiement === "credit" && (
        <>
          <Text style={[styles.label, { marginTop: 12 }]}>{t("nouvelle_creance_echeance", langue)}</Text>
          <Pressable onPress={() => setAfficherDateEcheance(true)} style={[styles.selecteurDate, { borderColor: colors.border }]}>
            <Text style={{ color: dateEcheance ? colors.textPrimary : colors.textMuted, fontSize: 14 }}>
              {dateEcheance || "AAAA-MM-JJ"}
            </Text>
            <Feather name="calendar" size={15} color={colors.textMuted} />
          </Pressable>
          {afficherDateEcheance && (
            <DateTimePicker
              value={dateEcheance ? new Date(dateEcheance) : new Date()}
              mode="date"
              onChange={(event: any, date?: Date) => {
                setAfficherDateEcheance(false);
                if (event.type === "set" && date) setDateEcheance(formaterDateSeule(date));
              }}
            />
          )}
        </>
      )}

      <Text style={[styles.label, { marginTop: 4 }]}>{t("vente_mode_paiement", langue)}</Text>
      <View style={styles.ligneDeux}>
        {(["cash", "momo", "credit"] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => setModePaiement(m)}
            style={[styles.choix, { borderColor: modePaiement === m ? colors.accent : colors.border, borderWidth: modePaiement === m ? 2 : 1 }]}
          >
            <Text style={{ color: modePaiement === m ? colors.accent : colors.textPrimary, fontSize: 12 }}>
              {t(`vente_paiement_${m}` as any, langue)}
            </Text>
          </Pressable>
        ))}
      </View>

     

      <Modal visible={selecteurProduitOuvert} transparent animationType="slide">
        <Pressable style={styles.fondModal} onPress={() => setSelecteurProduitOuvert(false)}>
          <Pressable style={[styles.feuille, { backgroundColor: colors.surface }]} onPress={() => {}}>
            {/* Recherche dans le catalogue : indispensable dès que la liste
                dépasse quelques produits. */}
            <View style={[styles.rechercheSelecteur, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Feather name="search" size={15} color={colors.textMuted} />
              <TextInput
                value={rechercheProduit}
                onChangeText={setRechercheProduit}
                placeholder={t("stock_recherche", langue)}
                placeholderTextColor={colors.textMuted}
                style={{ flex: 1, marginLeft: 8, color: colors.textPrimary, fontSize: 14, paddingVertical: 0 }}
              />
            </View>
            {/* État vide : aucun produit → message + raccourci vers l'ajout,
                au lieu d'une liste vide muette. */}
            {produits.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 24 }}>
                <Feather name="package" size={28} color={colors.textMuted} />
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 10, textAlign: "center" }}>
                  {t("stock_aucun_resultat", langue)}
                </Text>
                <Pressable
                  onPress={() => { setSelecteurProduitOuvert(false); router.push("/produit/nouveau"); }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}
                >
                  <Feather name="plus" size={14} color="#fff" />
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>{t("stock_ajouter_produit", langue)}</Text>
                </Pressable>
              </View>
            ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              {produits
                .filter((p) => p.nom.toLowerCase().includes(rechercheProduit.toLowerCase()))
                .map((p) => {
                const selectionne = selectionProduits.has(p.id);
                const rupture = p.quantiteStock <= 0;
                return (
                  <Pressable key={p.id} onPress={() => basculerSelectionProduit(p.id)} style={[styles.ligneChoixModal, { borderBottomColor: colors.border }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                      <View style={[styles.checkbox, { borderColor: selectionne ? colors.accent : colors.border, backgroundColor: selectionne ? colors.accent : "transparent" }]}>
                        {selectionne && <Feather name="check" size={12} color="#fff" />}
                      </View>
                      {/* Image du produit : on repère un article d'un coup d'œil. */}
                      <AvatarNom nom={p.nom} imageUri={p.imageUri} taille={38} />
                      <View>
                        <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{p.nom}</Text>
                        <Text style={{ color: rupture ? colors.danger : colors.textMuted, fontSize: 11 }}>
                          {rupture ? t("stock_statut_rupture", langue) : `${t("vente_en_stock_court", langue)} ${p.quantiteStock}`}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{formater(p.prixVente)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            )}
            <Pressable
              onPress={confirmerSelection}
              disabled={selectionProduits.size === 0}
              style={[styles.boutonConfirmer, { backgroundColor: colors.accent, opacity: selectionProduits.size === 0 ? 0.5 : 1 }]}
            >
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
                {t("vente_ajouter_produit", langue)}{selectionProduits.size > 0 ? ` (${selectionProduits.size})` : ""}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={selecteurClientOuvert} transparent animationType="slide">
        <Pressable style={styles.fondModal} onPress={() => setSelecteurClientOuvert(false)}>
          <View style={[styles.feuille, { backgroundColor: colors.surface }]}>
            {/* État vide : aucun client connu → message clair. */}
            {clients.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 24 }}>
                <Feather name="users" size={28} color={colors.textMuted} />
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 10, textAlign: "center" }}>
                  {t("clients_vide_titre", langue)}
                </Text>
              </View>
            ) : (
              <ScrollView>
                {clients.map((c) => (
                  <Pressable key={c.nom} onPress={() => importerClient(c)} style={[styles.ligneChoixModal, { borderBottomColor: colors.border }]}>
                    <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{c.nom}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={scannerOuvert} animationType="slide">
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          {permissionCamera?.granted ? (
            <>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                onBarcodeScanned={surBarcodeScanne}
                barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "code93", "qr"] }}
              />
              <View style={styles.scannerOverlay}>
                <View style={styles.scannerEntete}>
                  <Pressable onPress={quitterScanner}>
                    <Feather name="x" size={22} color="#fff" />
                  </Pressable>
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "500" }}>{t("vente_scanner", langue)}</Text>
                  <View style={{ width: 22 }} />
                </View>
                <View style={styles.scannerCadre} />
                <Text style={styles.scannerAide}>{t("vente_scan_aide", langue)}</Text>
              </View>

              {resultatScan && (
                <View style={styles.overlayResultatScan}>
                  <View style={[styles.carteResultatScan, { backgroundColor: colors.surface }]}>
                    <Feather name={resultatScan.type === "trouve" ? "check-circle" : "alert-circle"} size={32} color={resultatScan.type === "trouve" ? colors.success : colors.warning} />
                    <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600", marginTop: 8, textAlign: "center" }}>
                      {resultatScan.type === "trouve" ? resultatScan.produit.nom : t("vente_scan_produit_introuvable", langue)}
                    </Text>
                    {resultatScan.type === "trouve" ? (
                      <>
                        <Pressable onPress={ajouterResultatAuPanier} style={[styles.boutonResultatScan, { backgroundColor: colors.accent }]}>
                          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>{t("vente_scan_ajouter_vente", langue)}</Text>
                        </Pressable>
                        <Pressable onPress={reanalyser} style={[styles.boutonResultatScan, { borderColor: colors.border, borderWidth: 1 }]}>
                          <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{t("vente_scan_reanalyser", langue)}</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Pressable onPress={reanalyser} style={[styles.boutonResultatScan, { borderColor: colors.border, borderWidth: 1 }]}>
                        <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{t("vente_scan_reanalyser", langue)}</Text>
                      </Pressable>
                    )}
                    <Pressable onPress={quitterScanner} style={{ marginTop: 12 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("scan_quitter", langue)}</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </>
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
              <Text style={{ color: "#fff", marginBottom: 16, textAlign: "center" }}>{t("vente_camera_permission", langue)}</Text>
              <Pressable onPress={demanderPermissionCamera} style={{ backgroundColor: colors.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }}>
                <Text style={{ color: "#fff" }}>{t("vente_camera_autoriser", langue)}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>

      {/* Après l'enregistrement : proposition d'envoi du reçu au client.
          Le nom est facultatif, le numéro WhatsApp obligatoire. */}
      <Modal visible={modalRecuOuvert} transparent animationType="fade" onRequestClose={() => { setModalRecuOuvert(false); router.back(); }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={styles.fondModalCentre}>
            <View style={[styles.carteModalCentre, { backgroundColor: colors.surface }]}>
              <View style={[styles.iconeModalCentre, { backgroundColor: colors.successBg }]}>
                <Feather name="check-circle" size={24} color={colors.success} />
              </View>
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "600", textAlign: "center" }}>
                {t("recu_proposer_titre", langue)}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center", marginTop: 6 }}>
                {t("recu_proposer_texte", langue)}
              </Text>

              <TextInput
                value={recuNom}
                onChangeText={setRecuNom}
                placeholder={t("recu_modal_nom", langue)}
                placeholderTextColor={colors.textMuted}
                style={[styles.inputModal, { borderColor: colors.border, color: colors.textPrimary }]}
              />
              <TextInput
                value={recuTelephone}
                onChangeText={setRecuTelephone}
                placeholder={t("recu_modal_telephone", langue)}
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                style={[styles.inputModal, { borderColor: colors.border, color: colors.textPrimary }]}
              />

              <View style={{ flexDirection: "row", gap: 10, marginTop: 16, alignSelf: "stretch" }}>
                <Pressable onPress={() => { setModalRecuOuvert(false); router.back(); }} style={[styles.boutonModal, { borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "500" }}>{t("rappel_essai_plus_tard", langue)}</Text>
                </Pressable>
                <Pressable onPress={envoyerRecu} style={[styles.boutonModal, { backgroundColor: "#25D366" }]}>
                  <Feather name="send" size={14} color="#fff" />
                  <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{t("recu_partager", langue)}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>

      <View style={{ flexDirection: "row", gap: 10, padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }}>
        <Pressable onPress={() => sauvegarder(false)} disabled={chargement} style={[styles.boutonSauver, { backgroundColor: colors.accent, flex: 1, opacity: chargement ? 0.6 : 1 }]}>
          <Feather name="check" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{chargement ? "..." : t("vente_enregistrer", langue)}</Text>
        </Pressable>
        <Pressable onPress={() => sauvegarder(true)} disabled={chargement} style={[styles.boutonSauver, { backgroundColor: colors.proFill, flex: 1, opacity: chargement ? 0.6 : 1 }]}>
          <Feather name="file-text" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{chargement ? "..." : t("vente_generer_facture", langue)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 50 },
  label: { fontSize: 12, marginBottom: 8, color: "#888" },
  lignePanier: { flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, paddingVertical: 8 },
  cartePanier: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10 },
  lignePanierHaut: { flexDirection: "row", alignItems: "center" },
  boutonRetirerLigne: { position: "absolute", top: 8, right: 8, zIndex: 1 },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", alignSelf: "center", gap: 4, marginTop: 10, borderRadius: 24, padding: 4 },
  boutonStepper: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  boutonQte: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  boutonAjouterProduit: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderStyle: "dashed", borderRadius: 8, paddingVertical: 11, marginTop: 20, marginBottom: 14 },
  bandeauTotal: { padding: 12, borderRadius: 10, marginBottom: 16, alignItems: "center" },
  ligneChampBouton: { flexDirection: "row", gap: 8, marginBottom: 14 },
  ligneNumero: { flexDirection: "row", gap: 8 },
  indicatif: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  boutonImporter: { width: 42, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  selecteurDate: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  ligneDeux: { flexDirection: "row", gap: 10 },
  choix: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  boutonSauver: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 10, marginTop: 10 },
  fondModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  feuille: { maxHeight: "75%", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  rechercheSelecteur: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 42, marginBottom: 10 },
  ligneChoixModal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  boutonConfirmer: { paddingVertical: 13, borderRadius: 10, alignItems: "center", marginTop: 12 },
  scannerOverlay: { flex: 1, justifyContent: "space-between", padding: 16, paddingTop: 50, paddingBottom: 40 },
  scannerEntete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scannerCadre: { width: 280, height: 160, borderWidth: 2, borderColor: "#fff", borderRadius: 8, borderStyle: "dashed", alignSelf: "center" },
  scannerAide: { color: "#fff", fontSize: 12, marginTop: 12, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, alignSelf: "center" },
  overlayResultatScan: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 24 },
  carteResultatScan: { width: "100%", maxWidth: 340, borderRadius: 16, padding: 20, alignItems: "center" },
  boutonResultatScan: { alignSelf: "stretch", paddingVertical: 12, borderRadius: 8, alignItems: "center", justifyContent: "center", marginTop: 10 },
  fondModalCentre: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  carteModalCentre: { width: "100%", maxWidth: 340, borderRadius: 16, padding: 24, alignItems: "center" },
  iconeModalCentre: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  inputModal: { alignSelf: "stretch", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, marginTop: 10 },
  boutonModal: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
});