import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";

export type Devise = { code: string; symbole: string; nom: string };

export const DEVISES: Devise[] = [
    { code: "XAF", symbole: "FCFA", nom: "Franc CFA (Cameroun, CEMAC)" },
    { code: "XOF", symbole: "FCFA", nom: "Franc CFA (Afrique de l'Ouest, UEMOA)" },
    { code: "NGN", symbole: "₦", nom: "Naira (Nigeria)" },
    { code: "GHS", symbole: "₵", nom: "Cedi (Ghana)" },
    { code: "ZAR", symbole: "R", nom: "Rand (Afrique du Sud)" },
    { code: "KES", symbole: "KSh", nom: "Shilling kényan (Kenya)" },
    { code: "UGX", symbole: "USh", nom: "Shilling ougandais (Ouganda)" },
    { code: "TZS", symbole: "TSh", nom: "Shilling tanzanien (Tanzanie)" },
    { code: "RWF", symbole: "FRw", nom: "Franc rwandais (Rwanda)" },
    { code: "BIF", symbole: "FBu", nom: "Franc burundais (Burundi)" },
    { code: "CDF", symbole: "FC", nom: "Franc congolais (RDC)" },
    { code: "EGP", symbole: "E£", nom: "Livre égyptienne (Égypte)" },
    { code: "MAD", symbole: "DH", nom: "Dirham marocain (Maroc)" },
    { code: "DZD", symbole: "DA", nom: "Dinar algérien (Algérie)" },
    { code: "TND", symbole: "DT", nom: "Dinar tunisien (Tunisie)" },
    { code: "LYD", symbole: "LD", nom: "Dinar libyen (Libye)" },
    { code: "SDG", symbole: "SDG", nom: "Livre soudanaise (Soudan)" },
    { code: "SSP", symbole: "SSP", nom: "Livre sud-soudanaise (Soudan du Sud)" },
    { code: "ETB", symbole: "Br", nom: "Birr éthiopien (Éthiopie)" },
    { code: "SOS", symbole: "Sh", nom: "Shilling somalien (Somalie)" },
    { code: "DJF", symbole: "Fdj", nom: "Franc djiboutien (Djibouti)" },
    { code: "ERN", symbole: "Nfk", nom: "Nakfa (Érythrée)" },
    { code: "MWK", symbole: "MK", nom: "Kwacha malawite (Malawi)" },
    { code: "ZMW", symbole: "ZK", nom: "Kwacha zambien (Zambie)" },
    { code: "BWP", symbole: "P", nom: "Pula (Botswana)" },
    { code: "NAD", symbole: "N$", nom: "Dollar namibien (Namibie)" },
    { code: "SZL", symbole: "E", nom: "Lilangeni (Eswatini)" },
    { code: "LSL", symbole: "L", nom: "Loti (Lesotho)" },
    { code: "MZN", symbole: "MT", nom: "Metical (Mozambique)" },
    { code: "AOA", symbole: "Kz", nom: "Kwanza (Angola)" },
    { code: "SCR", symbole: "₨", nom: "Roupie seychelloise (Seychelles)" },
    { code: "MUR", symbole: "₨", nom: "Roupie mauricienne (Maurice)" },
    { code: "KMF", symbole: "CF", nom: "Franc comorien (Comores)" },
    { code: "CVE", symbole: "$", nom: "Escudo cap-verdien (Cap-Vert)" },
    { code: "GMD", symbole: "D", nom: "Dalasi (Gambie)" },
    { code: "SLL", symbole: "Le", nom: "Leone (Sierra Leone)" },
    { code: "LRD", symbole: "L$", nom: "Dollar libérien (Libéria)" },
    { code: "GNF", symbole: "FG", nom: "Franc guinéen (Guinée)" },
];

type CurrencyContextValue = {
  devise: Devise;
  setDevise: (d: Devise) => void;
  formater: (montant: number) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);
const CLE_STOCKAGE = "boutika_devise";

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [devise, setDeviseState] = useState<Devise>(DEVISES[0]); // FCFA par défaut

  useEffect(() => {
    AsyncStorage.getItem(CLE_STOCKAGE).then((code) => {
      const trouvee = DEVISES.find((d) => d.code === code);
      if (trouvee) setDeviseState(trouvee);
    });
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
    return `${montant.toLocaleString()} ${devise.symbole}`;
  }

  return (
    <CurrencyContext.Provider value={{ devise, setDevise, formater }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency doit être utilisé dans <CurrencyProvider>");
  return ctx;
}