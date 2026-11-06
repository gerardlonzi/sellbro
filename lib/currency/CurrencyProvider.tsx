import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import { useLangue } from "@/lib/i18n";
import { abregerMontant } from "./compact";
import { convertirDepuisFcfa, DEVISES_PAR_PAYS, chargerTauxDepuisConfig } from "./taux";

export type Devise = { code: string; symbole: string; nom: string };

// Uniquement les devises des pays supportés par SasPay (Mobile Money).
export const DEVISES: Devise[] = [
  { code: "XAF", symbole: "FCFA", nom: "Franc CFA - Afrique Centrale" },
  { code: "XOF", symbole: "FCFA", nom: "Franc CFA - Afrique de l'Ouest" },
  { code: "CDF", symbole: "FC", nom: "Franc congolais (RD Congo)" },
  { code: "ETB", symbole: "Br", nom: "Birr éthiopien (Éthiopie)" },
  { code: "GHS", symbole: "₵", nom: "Cedi (Ghana)" },
  { code: "GNF", symbole: "FG", nom: "Franc guinéen (Guinée)" },
  { code: "KES", symbole: "KSh", nom: "Shilling kényan (Kenya)" },
  { code: "LSL", symbole: "L", nom: "Loti (Lesotho)" },
  { code: "MWK", symbole: "MK", nom: "Kwacha malawite (Malawi)" },
  { code: "MZN", symbole: "MT", nom: "Metical mozambicain (Mozambique)" },
  { code: "NGN", symbole: "₦", nom: "Naira (Nigeria)" },
  { code: "RWF", symbole: "FRw", nom: "Franc rwandais (Rwanda)" },
  { code: "SLE", symbole: "Le", nom: "Leone (Sierra Leone)" },
  { code: "SOS", symbole: "Ssh", nom: "Shilling somalien (Somalie)" },
  { code: "TZS", symbole: "TSh", nom: "Shilling tanzanien (Tanzanie)" },
  { code: "UGX", symbole: "USh", nom: "Shilling ougandais (Ouganda)" },
  { code: "ZMW", symbole: "ZK", nom: "Kwacha zambien (Zambie)" },
  { code: "ZAR", symbole: "R", nom: "Rand sud-africain (Afrique du Sud)" },
  { code: "MAD", symbole: "DH", nom: "Dirham marocain (Maroc)" },
  { code: "DZD", symbole: "DA", nom: "Dinar algérien (Algérie)" },
  { code: "TND", symbole: "DT", nom: "Dinar tunisien (Tunisie)" },
  { code: "EGP", symbole: "E£", nom: "Livre égyptienne (Égypte)" },
  { code: "AOA", symbole: "Kz", nom: "Kwanza angolais (Angola)" },
  { code: "BIF", symbole: "FBu", nom: "Franc burundais (Burundi)" },
  { code: "CVE", symbole: "$", nom: "Escudo cap-verdien (Cap-Vert)" },
  { code: "KMF", symbole: "CF", nom: "Franc comorien (Comores)" },
  { code: "DJF", symbole: "Fdj", nom: "Franc djiboutien (Djibouti)" },
  { code: "ERN", symbole: "Nfk", nom: "Nakfa érythréen (Érythrée)" },
  { code: "SZL", symbole: "L", nom: "Lilangeni (Eswatini)" },
  { code: "GMD", symbole: "D", nom: "Dalasi gambien (Gambie)" },
  { code: "LRD", symbole: "$", nom: "Dollar libérien (Libéria)" },
  { code: "LYD", symbole: "LD", nom: "Dinar libyen (Libye)" },
  { code: "MGA", symbole: "Ar", nom: "Ariary malgache (Madagascar)" },
  { code: "MUR", symbole: "₨", nom: "Roupie mauricienne (Maurice)" },
  { code: "NAD", symbole: "$", nom: "Dollar namibien (Namibie)" },
  { code: "STN", symbole: "Db", nom: "Dobra (Sao Tomé-et-Principe)" },
  { code: "SCR", symbole: "₨", nom: "Roupie seychelloise (Seychelles)" },
  { code: "SDG", symbole: "LS", nom: "Livre soudanaise (Soudan)" },
  { code: "ZWD", symbole: "Z$", nom: "Dollar zimbabwéen (Zimbabwe)" },

  // --- Pays Émergents & Asie / Amériques ---
  { code: "BRL", symbole: "R$", nom: "Réal brésilien (Brésil)" },
  { code: "INR", symbole: "₹", nom: "Roupie indienne (Inde)" },
  { code: "CNY", symbole: "¥", nom: "Yuan chinois (Chine)" },
  { code: "JPY", symbole: "¥", nom: "Yen japonais (Japon)" },
  { code: "MXN", symbole: "$", nom: "Peso mexicain (Mexique)" },
  { code: "ARS", symbole: "$", nom: "Peso argentin (Argentine)" },

  // --- International / Majeures ---
  { code: "USD", symbole: "$", nom: "Dollar américain (International / USA / RDC USD / Crypto)" },
  { code: "EUR", symbole: "€", nom: "Euro (Zone Euro / Europe)" },
  { code: "GBP", symbole: "£", nom: "Livre sterling (Royaume-Uni)" },
  { code: "CAD", symbole: "C$", nom: "Dollar canadien (Canada)" },
  { code: "AUD", symbole: "A$", nom: "Dollar australien (Australie)" },
  { code: "NZD", symbole: "NZ$", nom: "Dollar néo-zélandais (Nouvelle-Zélande)" },
  { code: "CHF", symbole: "CHF", nom: "Franc suisse (Suisse)" },
  { code: "AED", symbole: "AED", nom: "Dirham des Émirats arabes unis" },
  { code: "SAR", symbole: "SAR", nom: "Riyal saoudien (Arabie saoudite)" },
  { code: "QAR", symbole: "QAR", nom: "Riyal qatari (Qatar)" }

];

type CurrencyContextValue = {
  devise: Devise;
  setDevise: (d: Devise) => void;
  formater: (montant: number) => string;
  // Variante compacte pour les cartes : abrège les grands montants
  // (100 000 → « 100K », 1 500 000 → « 1,5M ») au lieu de déborder.
  formaterCompact: (montant: number) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);
const CLE_STOCKAGE = "boutika_devise";

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [devise, setDeviseState] = useState<Devise>(DEVISES[0]); // FCFA par défaut
  const { langue: langueCourante } = useLangue();

  useEffect(() => {
    (async () => {
      // Charge les taux depuis la base (ou le cache local) avant tout affichage.
      await chargerTauxDepuisConfig();

      // 1) Devise explicitement choisie par l'utilisateur.
      const code = await AsyncStorage.getItem(CLE_STOCKAGE);
      if (code) {
        const trouvee = DEVISES.find((d) => d.code === code);
        if (trouvee) { setDeviseState(trouvee); return; }
      }
      // 2) Sinon, devise déduite du pays sélectionné (jamais FCFA hors zone CFA).
      const codePays = await AsyncStorage.getItem("boutika_pays");
      const deviseCode = codePays ? DEVISES_PAR_PAYS[codePays] : undefined;
      if (deviseCode) {
        const trouvee = DEVISES.find((d) => d.code === deviseCode);
        if (trouvee) setDeviseState(trouvee);
      }
    })();
  }, []);

  async function setDevise(d: Devise) {
    setDeviseState(d);
    await AsyncStorage.setItem(CLE_STOCKAGE, d.code);

    // Propage le choix à tout le compte (pas juste cet appareil)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ devise: d.code }).eq("id", user.id);
    }
  }

  function formater(montant: number) {
    // Les montants sont stockés en FCFA (XAF) ; on convertit vers la devise
    // locale de l'utilisateur pour ne jamais afficher de FCFA hors zone CFA.
    const converti = convertirDepuisFcfa(montant, devise.code);
    return `${converti.toLocaleString()} ${devise.symbole}`;
  }

  function formaterCompact(montant: number) {
    const converti = convertirDepuisFcfa(montant, devise.code);
    return `${abregerMontant(converti, langueCourante)}\u00a0${devise.symbole}`;
  }

  return (
    <CurrencyContext.Provider value={{ devise, setDevise, formater, formaterCompact }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency doit être utilisé dans <CurrencyProvider>");
  return ctx;
}