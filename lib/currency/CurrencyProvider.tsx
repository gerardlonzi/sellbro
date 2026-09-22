import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import { convertirDepuisFcfa, DEVISES_PAR_PAYS, chargerTauxDepuisConfig } from "./taux";

export type Devise = { code: string; symbole: string; nom: string };

// Uniquement les devises des pays supportés par SasPay (Mobile Money).
export const DEVISES: Devise[] = [
    { code: "XAF", symbole: "FCFA", nom: "Franc CFA (Cameroun)" },
    { code: "XOF", symbole: "FCFA", nom: "Franc CFA (Afrique de l'Ouest)" },
    { code: "CDF", symbole: "FC", nom: "Franc congolais (RDC)" },
    { code: "GHS", symbole: "₵", nom: "Cedi (Ghana)" },
    { code: "GNF", symbole: "FG", nom: "Franc guinéen (Guinée)" },
    { code: "KES", symbole: "KSh", nom: "Shilling kényan (Kenya)" },
    { code: "MWK", symbole: "MK", nom: "Kwacha malawite (Malawi)" },
    { code: "NGN", symbole: "₦", nom: "Naira (Nigeria)" },
    { code: "RWF", symbole: "FRw", nom: "Franc rwandais (Rwanda)" },
    { code: "TZS", symbole: "TSh", nom: "Shilling tanzanien (Tanzanie)" },
    { code: "UGX", symbole: "USh", nom: "Shilling ougandais (Ouganda)" },
    { code: "ZMW", symbole: "ZK", nom: "Kwacha zambien (Zambie)" },
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