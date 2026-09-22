// Opérateurs Mobile Money supportés par SasPay, par pays.
// Source : https://docs.saspay.me/api-reference/payments/softpay
// (les réseaux marqués « inactif » dans la doc sont exclus).
//
// Les logos viennent de assets/. Les logos au format SVG (celtiis, vodacom,
// vodafone, TNM) ne sont pas affichables par l'Image de React Native : ces
// opérateurs ont logo: null et tombent sur la carte colorée avec le nom.
//
// Le prix par devise est lu côté serveur dans plans.prix_par_devise (jsonb) —
// SasPay ne convertit PAS les montants Mobile Money : l'app facture dans la
// devise du pays.
import { ImageSourcePropType } from "react-native";

const LOGOS = {
  mtn: require("../../assets/MoMo.logo.webp"),
  orange: require("../../assets/Orange-Money-emblem.png"),
  moov: require("../../assets/logo-moov-money-2x.png"),
  wave: require("../../assets/wave.png"),
  airtel: require("../../assets/airtel-logo.png"),
  airteltigo: require("../../assets/airteltigo.png"),
  mpesa: require("../../assets/mpesa.png"),
  freemoney: require("../../assets/free-money.png"),
  wizall: require("../../assets/wizall.png"),
  mobicash: require("../../assets/mobicash-logo.jpg"),
  togocel: require("../../assets/togocel.jpg"),
  halopesa: require("../../assets/halopesa.png"),
  zamtel: require("../../assets/zamtel-logo.png"),
} satisfies Record<string, ImageSourcePropType>;

export type Operateur = {
  reseau: string; // code réseau SasPay (ex. "mtn_cm")
  nom: string;    // nom affiché (ex. "MTN MoMo")
  couleur: string;
  texte: string;  // couleur du texte sur la carte
  logo: ImageSourcePropType | null;
};

export type PaysPaiement = {
  codePays: string; // ISO 3166-1 alpha-2 (ex. "CM")
  devise: string;   // devise de facturation SasPay (ex. "XAF")
  operateurs: Operateur[];
};

const COULEURS = {
  mtn: { couleur: "#FFCC00", texte: "#1a1a1a" },
  orange: { couleur: "#FF6600", texte: "#ffffff" },
  moov: { couleur: "#0066B3", texte: "#ffffff" },
  wave: { couleur: "#1DC4F2", texte: "#1a1a1a" },
  airtel: { couleur: "#E30613", texte: "#ffffff" },
  mpesa: { couleur: "#009F4D", texte: "#ffffff" },
  generique: { couleur: "#5A5A55", texte: "#ffffff" },
};

function op(reseau: string, nom: string, couleurs: { couleur: string; texte: string }, logo: ImageSourcePropType | null): Operateur {
  return { reseau, nom, couleur: couleurs.couleur, texte: couleurs.texte, logo };
}

export const PAIEMENTS_PAR_PAYS: Record<string, PaysPaiement> = {
  CM: {
    codePays: "CM", devise: "XAF",
    operateurs: [
      op("mtn_cm", "MTN MoMo", COULEURS.mtn, LOGOS.mtn),
      op("orange_cm", "Orange Money", COULEURS.orange, LOGOS.orange),
    ],
  },
  CI: {
    codePays: "CI", devise: "XOF",
    operateurs: [
      op("mtn_ci", "MTN MoMo", COULEURS.mtn, LOGOS.mtn),
      op("orange_ci", "Orange Money", COULEURS.orange, LOGOS.orange),
      op("moov_ci", "Moov Money", COULEURS.moov, LOGOS.moov),
      op("wave_ci", "Wave", COULEURS.wave, LOGOS.wave),
    ],
  },
  SN: {
    codePays: "SN", devise: "XOF",
    operateurs: [
      op("orange_sn", "Orange Money", COULEURS.orange, LOGOS.orange),
      op("wave_sn", "Wave", COULEURS.wave, LOGOS.wave),
      op("freemoney_sn", "Free Money", { couleur: "#E30613", texte: "#ffffff" }, LOGOS.freemoney),
      op("wizall_sn", "Wizall", COULEURS.generique, LOGOS.wizall),
    ],
  },
  BJ: {
    codePays: "BJ", devise: "XOF",
    operateurs: [
      op("mtn_bj", "MTN MoMo", COULEURS.mtn, LOGOS.mtn),
      op("moov_bj", "Moov Money", COULEURS.moov, LOGOS.moov),
      op("celtiis_bj", "Celtiis Cash", COULEURS.generique, null),
    ],
  },
  BF: {
    codePays: "BF", devise: "XOF",
    operateurs: [
      op("moov_bf", "Moov Money", COULEURS.moov, LOGOS.moov),
      op("orange_bf", "Orange Money", COULEURS.orange, LOGOS.orange),
    ],
  },
  ML: {
    codePays: "ML", devise: "XOF",
    operateurs: [
      op("orange_ml", "Orange Money", COULEURS.orange, LOGOS.orange),
      op("moov_ml", "Moov Money", COULEURS.moov, LOGOS.moov),
      op("mobi_cash_ml", "Mobi Cash", COULEURS.generique, LOGOS.mobicash),
    ],
  },
  NE: {
    codePays: "NE", devise: "XOF",
    operateurs: [op("airtel_ne", "Airtel Money", COULEURS.airtel, LOGOS.airtel)],
  },
  TG: {
    codePays: "TG", devise: "XOF",
    operateurs: [
      op("moov_tg", "Moov Money", COULEURS.moov, LOGOS.moov),
      op("togocel", "Togocel Money", COULEURS.generique, LOGOS.togocel),
    ],
  },
  CD: {
    codePays: "CD", devise: "CDF",
    operateurs: [
      op("orange_cd", "Orange Money", COULEURS.orange, LOGOS.orange),
      op("airtel_cd", "Airtel Money", COULEURS.airtel, LOGOS.airtel),
      op("vodacom_cd", "M-Pesa", COULEURS.mpesa, null),
    ],
  },
  GH: {
    codePays: "GH", devise: "GHS",
    operateurs: [
      op("mtn_gh", "MTN MoMo", COULEURS.mtn, LOGOS.mtn),
      op("vodafone_gh", "Telecel Cash", { couleur: "#E30613", texte: "#ffffff" }, null),
      op("tigo_gh", "AirtelTigo", COULEURS.airtel, LOGOS.airteltigo),
    ],
  },
  GN: {
    codePays: "GN", devise: "GNF",
    operateurs: [op("mtn_gn", "MTN MoMo", COULEURS.mtn, LOGOS.mtn)],
  },
  KE: {
    codePays: "KE", devise: "KES",
    operateurs: [op("mpesa_ke", "M-Pesa", COULEURS.mpesa, LOGOS.mpesa)],
  },
  MW: {
    codePays: "MW", devise: "MWK",
    operateurs: [
      op("airtel_mw", "Airtel Money", COULEURS.airtel, LOGOS.airtel),
      op("tnm_mw", "TNM Mpamba", COULEURS.generique, null),
    ],
  },
  NG: {
    codePays: "NG", devise: "NGN",
    operateurs: [
      op("mtn_ng", "MTN", COULEURS.mtn, LOGOS.mtn),
      op("airtel_ng", "Airtel Money", COULEURS.airtel, LOGOS.airtel),
    ],
  },
  RW: {
    codePays: "RW", devise: "RWF",
    operateurs: [
      op("mtn_rw", "MTN MoMo", COULEURS.mtn, LOGOS.mtn),
      op("airtel_rw", "Airtel Money", COULEURS.airtel, LOGOS.airtel),
    ],
  },
  TZ: {
    codePays: "TZ", devise: "TZS",
    operateurs: [
      op("mpesa_tz", "M-Pesa", COULEURS.mpesa, LOGOS.mpesa),
      op("airtel_tz", "Airtel Money", COULEURS.airtel, LOGOS.airtel),
      op("tigo_tz", "Tigo Pesa", COULEURS.generique, LOGOS.airteltigo),
      op("halopesa_tz", "Halopesa", COULEURS.generique, LOGOS.halopesa),
    ],
  },
  UG: {
    codePays: "UG", devise: "UGX",
    operateurs: [
      op("mtn_ug", "MTN MoMo", COULEURS.mtn, LOGOS.mtn),
      op("airtel_ug", "Airtel Money", COULEURS.airtel, LOGOS.airtel),
    ],
  },
  ZM: {
    codePays: "ZM", devise: "ZMW",
    operateurs: [
      op("mtn_zm", "MTN MoMo", COULEURS.mtn, LOGOS.mtn),
      op("airtel_zm", "Airtel Money", COULEURS.airtel, LOGOS.airtel),
      op("zamtel_zm", "Zamtel Kwacha", COULEURS.generique, LOGOS.zamtel),
    ],
  },
};

// Pays par défaut si le pays de l'utilisateur n'est pas (encore) supporté.
export const PAYS_PAIEMENT_DEFAUT = "CM";

export function paiementsDuPays(codePays: string | undefined): PaysPaiement {
  return PAIEMENTS_PAR_PAYS[codePays ?? ""] ?? PAIEMENTS_PAR_PAYS[PAYS_PAIEMENT_DEFAUT];
}
