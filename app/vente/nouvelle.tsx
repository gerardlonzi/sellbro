import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Modal } from "react-native";
import { router } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { useLangue, t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase/client";
import { database } from "@/lib/database";
import { Q } from "@nozbe/watermelondb";
import { EnteteEcran } from "@/components/UI";
import { enregistrerMouvementStock } from "@/lib/stock/mouvements";
import { obtenirUserId } from "@/lib/auth/userCache";
import { synchroniserPourUtilisateurCourant } from "@/lib/database/sync";
import { enregistrerActivite } from "@/lib/audit/journal";
import { creerFactureDepuisVentes } from "@/lib/factures/creerFacture";
import DateTimePicker from "@react-native-community/datetimepicker";
import { peutEcrire } from "@/lib/trial/gate";
import { afficherPaywall } from "@/lib/trial/paywall";
import { formaterDateSeule } from "@/lib/formatDate";
import { usePays } from "@/lib/pays/PaysProvider";
import { validerTelephone } from "@/lib/pays/validation";
import { useCurrency } from "@/lib/currency/CurrencyProvider";

type Produit = { id: string; nom: string; prixVente: number; quantiteStock: number };
type LigneVente = { produitId: string | null; nom: string; quantite: number; prixUnitaire: number };
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
  const [permissionCamera, demanderPermissionCamera] = useCameraPermissions();

  async function ouvrirSelecteurProduit() {
    const userId = await obtenirUserId();
    if (!userId) return;
    const resultats = await database.get("produits").query(Q.where("user_id", userId)).fetch();
    setProduits((resultats as any[]).map((p) => ({ id: p.id, nom: p.nom, prixVente: p.prixVente, quantiteStock: p.quantiteStock })));
    setSelectionProduits(new Set());
    setSelecteurProduitOuvert(true);
  }

  function ajouterAuPanier(p: Produit) {
    setPanier((actuel) => {
      const existant = actuel.find((l) => l.produitId === p.id);
      if (existant) {
        return actuel.map((l) => (l.produitId === p.id ? { ...l, quantite: l.quantite + 1 } : l));
      }
      return [...actuel, { produitId: p.id, nom: p.nom, quantite: 1, prixUnitaire: p.prixVente }];
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
  function modifierQuantiteManuelle(index: number, valeur: string) {
    const n = parseInt(valeur, 10);
    if (isNaN(n)) return;
    setPanier((actuel) =>
      actuel.map((l, i) => (i === index ? { ...l, quantite: Math.max(1, n) } : l))
    );
  }

  function retirerDuPanier(index: number) {
    setPanier((actuel) => actuel.filter((_, i) => i !== index));
  }

  async function ouvrirSelecteurClient() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const ventes = await database.get("ventes").query(Q.where("user_id", user.id)).fetch();
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setChargement(false); return; }

    const venteIds: string[] = [];
    // Identifiant de « transaction » commun à toutes les lignes du panier :
    // permet de compter les VENTES (transactions) séparément des UNITÉS vendues.
    const transactionId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await database.write(async () => {
      for (const ligne of panier) {
        const vente = await database.get("ventes").create((v: any) => {
          v.userId = user.id;
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
          c.userId = user.id;
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
          userId: user.id,
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
      const factureId = await creerFactureDepuisVentes(user.id, venteIds);
      setChargement(false);
      router.replace(`/factures/${factureId}`);
      return;
    }

    setChargement(false);
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
        <View key={i} style={[styles.lignePanier, { borderColor: colors.border }]}>
          <Text style={{ color: colors.textPrimary, fontSize: 13, flex: 1 }}>{ligne.nom}</Text>
          <Pressable onPress={() => modifierQuantite(i, -1)} style={[styles.boutonQte, { borderColor: colors.border }]}>
            <Feather name="minus" size={16} color={colors.textPrimary} />
          </Pressable>
          <TextInput
            value={String(ligne.quantite)}
            onChangeText={(v) => modifierQuantiteManuelle(i, v)}
            keyboardType="numeric"
            style={{ width: 40, textAlign: "center", color: colors.textPrimary, fontSize: 15, fontWeight: "700", borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 2 }}
          />
          <Pressable onPress={() => modifierQuantite(i, 1)} style={[styles.boutonQte, { borderColor: colors.border }]}>
            <Feather name="plus" size={16} color={colors.textPrimary} />
          </Pressable>
          <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "700", width: 70, textAlign: "right" }}>
            {formater(ligne.quantite * ligne.prixUnitaire)}
          </Text>
          <Pressable onPress={() => retirerDuPanier(i)} hitSlop={8}>
            <Feather name="x" size={16} color={colors.danger} />
          </Pressable>
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

      <Modal visible={selecteurProduitOuvert} transparent animationType="slide">
        <Pressable style={styles.fondModal} onPress={() => setSelecteurProduitOuvert(false)}>
          <Pressable style={[styles.feuille, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <ScrollView>
              {produits.map((p) => {
                const selectionne = selectionProduits.has(p.id);
                return (
                  <Pressable key={p.id} onPress={() => basculerSelectionProduit(p.id)} style={[styles.ligneChoixModal, { borderBottomColor: colors.border }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                      <View style={[styles.checkbox, { borderColor: selectionne ? colors.accent : colors.border, backgroundColor: selectionne ? colors.accent : "transparent" }]}>
                        {selectionne && <Feather name="check" size={12} color="#fff" />}
                      </View>
                      <View>
                        <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{p.nom}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{t("vente_en_stock_court", langue)} {p.quantiteStock}</Text>
                      </View>
                    </View>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{formater(p.prixVente)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
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
            <ScrollView>
              {clients.map((c) => (
                <Pressable key={c.nom} onPress={() => importerClient(c)} style={[styles.ligneChoixModal, { borderBottomColor: colors.border }]}>
                  <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{c.nom}</Text>
                </Pressable>
              ))}
            </ScrollView>
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
  feuille: { maxHeight: "60%", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
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
});