import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import { enregistrerActivite } from "@/lib/audit/journal";

export type InfosBoutique = {
  nom: string;
  telephone: string | null;
  email: string | null;
  secteur: string | null;
  logo: string | null; // data URI (base64)
};

// Récupère les infos de l'entreprise : nom, contact, secteur et logo.
// Le logo est stocké localement (AsyncStorage) ; s'il manque, on affiche
// simplement le nom de la boutique en en-tête.
const CLE_INFOS = "boutika_infos";

async function infosDepuisSupabase(): Promise<InfosBoutique> {
  let nom = "Ma boutique";
  let telephone: string | null = null;
  let email: string | null = null;
  let secteur: string | null = null;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        nom = data.nom_boutique || nom;
        telephone = data.telephone;
        email = data.email ?? user.email;
        secteur = data.secteur;
      }
    }
  } catch {
    // Hors ligne : on garde les valeurs par défaut.
  }

  const logo = await AsyncStorage.getItem("boutika_logo");
  return { nom, telephone, email, secteur, logo };
}

export async function obtenirInfosBoutique(): Promise<InfosBoutique> {
  // 1. Cache local : retour immédiat — imprimer ne doit jamais attendre le réseau.
  const cache = await AsyncStorage.getItem(CLE_INFOS);
  if (cache) {
    // Rafraîchit en arrière-plan pour la prochaine fois (non bloquant).
    infosDepuisSupabase()
      .then((infos) => AsyncStorage.setItem(CLE_INFOS, JSON.stringify(infos)))
      .catch(() => {});
    return JSON.parse(cache) as InfosBoutique;
  }

  // 2. Premier appel (pas encore de cache) : on va chercher puis on met en cache.
  const infos = await infosDepuisSupabase();
  AsyncStorage.setItem(CLE_INFOS, JSON.stringify(infos)).catch(() => {});
  return infos;
}

function enteteHtml(infos: InfosBoutique, titre: string, sousTitre?: string): string {
  const logoHtml = infos.logo
    ? `<img src="${infos.logo}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;" />`
    : `<div style="width:64px;height:64px;border-radius:8px;background:#25af93;color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:bold;">${(infos.nom || "M").charAt(0).toUpperCase()}</div>`;

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #25af93;padding-bottom:12px;margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:12px;">
        ${logoHtml}
        <div>
          <div style="font-size:20px;font-weight:bold;color:#1A1A18;">${infos.nom}</div>
          ${infos.secteur ? `<div style="font-size:12px;color:#6B6A64;">${infos.secteur}</div>` : ""}
        </div>
      </div>
      <div style="text-align:right;font-size:11px;color:#6B6A64;">
        ${infos.telephone ? `<div>${infos.telephone}</div>` : ""}
        ${infos.email ? `<div>${infos.email}</div>` : ""}
      </div>
    </div>
    <div style="margin-bottom:20px;">
      <div style="font-size:16px;font-weight:bold;color:#1A1A18;">${titre}</div>
      ${sousTitre ? `<div style="font-size:12px;color:#6B6A64;">${sousTitre}</div>` : ""}
    </div>`;
}

function piedHtml(): string {
  return `<div style="margin-top:30px;padding-top:10px;border-top:1px solid #E5E3DC;font-size:10px;color:#9B9A93;text-align:center;">Document généré par CIKAP</div>`;
}

const STYLE = `<style>
  * { font-family: Arial, sans-serif; }
  body { padding: 24px; color: #1A1A18; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { text-align: left; font-size: 11px; color: #6B6A64; padding: 8px 6px; border-bottom: 1px solid #E5E3DC; }
  td { font-size: 12px; padding: 8px 6px; border-bottom: 1px solid #F0EFEA; }
  .droite { text-align: right; }
  .total { font-size: 14px; font-weight: bold; }
</style>`;

async function partager(html: string, nomFichier: string) {
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: nomFichier });
  }
}

// Génère et partage une facture PDF.
export async function genererFacturePdf(facture: any, lignes: any[]) {
  const infos = await obtenirInfosBoutique();
  const lignesHtml = lignes
    .map(
      (l) => `<tr>
        <td>${l.produitNom}</td>
        <td class="droite">${l.quantite}</td>
        <td class="droite">${(l.prixUnitaire || 0).toLocaleString()} F</td>
        <td class="droite">${((l.quantite || 0) * (l.prixUnitaire || 0)).toLocaleString()} F</td>
      </tr>`
    )
    .join("");

  const html = `<html><head>${STYLE}</head><body>
    ${enteteHtml(infos, "FACTURE", `${facture.numero} — ${facture.clientNom ?? ""}`)}
    <table>
      <tr><th>Produit</th><th class="droite">Qté</th><th class="droite">Prix unitaire</th><th class="droite">Montant</th></tr>
      ${lignesHtml}
    </table>
    <table style="width:auto;margin-left:auto;min-width:200px;">
      <tr><td>Sous-total</td><td class="droite">${(facture.sousTotal || 0).toLocaleString()} F</td></tr>
      ${facture.remise ? `<tr><td>Remise</td><td class="droite">- ${facture.remise.toLocaleString()} F</td></tr>` : ""}
      <tr><td class="total">Total</td><td class="droite total">${(facture.total || 0).toLocaleString()} F</td></tr>
    </table>
    ${piedHtml()}
  </body></html>`;

  await partager(html, `Facture-${facture.numero}.pdf`);
  await enregistrerActivite("impression", "ajout", `Facture ${facture.numero} imprimée`);
}

// Génère et partage un export comptable PDF.
export async function genererExportPdf(stats: { ca: number; benefice: number; ventes: number; parPaiement: Record<string, number> }, periodeLabel: string) {
  const infos = await obtenirInfosBoutique();
  const paiementHtml = Object.entries(stats.parPaiement)
    .map(([mode, montant]) => `<tr><td>${mode}</td><td class="droite">${montant.toLocaleString()} F</td></tr>`)
    .join("");

  const html = `<html><head>${STYLE}</head><body>
    ${enteteHtml(infos, "EXPORT COMPTABLE", periodeLabel)}
    <table>
      <tr><th>Indicateur</th><th class="droite">Valeur</th></tr>
      <tr><td>Chiffre d'affaires</td><td class="droite">${stats.ca.toLocaleString()} F</td></tr>
      <tr><td>Bénéfice estimé</td><td class="droite">${stats.benefice.toLocaleString()} F</td></tr>
      <tr><td>Nombre de ventes</td><td class="droite">${stats.ventes}</td></tr>
    </table>
    ${paiementHtml ? `<div style="font-size:13px;font-weight:bold;margin-top:16px;">Par mode de paiement</div><table><tr><th>Mode</th><th class="droite">Montant</th></tr>${paiementHtml}</table>` : ""}
    ${piedHtml()}
  </body></html>`;

  await partager(html, `Export-comptable.pdf`);
  await enregistrerActivite("impression", "ajout", "Export comptable généré");
}

// Génère et partage un reçu de vente (ticket) PDF.
export async function genererRecuPdf(
  client: string | null,
  telephone: string | null,
  lignes: { nom: string; quantite: number; prixUnitaire: number }[],
  total: number
) {
  const infos = await obtenirInfosBoutique();
  const lignesHtml = lignes
    .map(
      (l) => `<tr>
        <td>${l.nom}</td>
        <td class="droite">${l.quantite}</td>
        <td class="droite">${(l.quantite * l.prixUnitaire).toLocaleString()} F</td>
      </tr>`
    )
    .join("");

  const html = `<html><head>${STYLE}</head><body>
    ${enteteHtml(infos, "REÇU DE VENTE", new Date().toLocaleString())}
    ${client ? `<div style="font-size:12px;margin-bottom:8px;"><b>Client :</b> ${client}${telephone ? ` — ${telephone}` : ""}</div>` : ""}
    <table>
      <tr><th>Produit</th><th class="droite">Qté</th><th class="droite">Montant</th></tr>
      ${lignesHtml}
    </table>
    <table style="width:auto;margin-left:auto;min-width:180px;">
      <tr><td class="total">Total</td><td class="droite total">${total.toLocaleString()} F</td></tr>
    </table>
    ${piedHtml()}
  </body></html>`;

  await partager(html, `Recu-vente.pdf`);
  await enregistrerActivite("impression", "ajout", "Reçu de vente imprimé");
}