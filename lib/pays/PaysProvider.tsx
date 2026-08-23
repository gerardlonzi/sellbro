import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import { PAYS, PAYS_PAR_DEFAUT, Pays } from "./pays";

type PaysContextValue = { pays: Pays; setPays: (p: Pays) => void };
const PaysContext = createContext<PaysContextValue | null>(null);
const CLE_STOCKAGE = "boutika_pays";

export function PaysProvider({ children }: { children: React.ReactNode }) {
  const [pays, setPaysState] = useState<Pays>(PAYS_PAR_DEFAUT);

  useEffect(() => {
    AsyncStorage.getItem(CLE_STOCKAGE).then((codeSauvegarde) => {
      if (codeSauvegarde) {
        const trouve = PAYS.find((p) => p.code === codeSauvegarde);
        if (trouve) return setPaysState(trouve);
      }
      // Pas de préférence sauvegardée : on détecte depuis la région du
      // téléphone (fonctionne hors ligne, c'est une info locale au device).
      const regionTelephone = Localization.getLocales()[0]?.regionCode;
      const trouveParRegion = PAYS.find((p) => p.code === regionTelephone);
      if (trouveParRegion) setPaysState(trouveParRegion);
    });
  }, []);

  async function setPays(p: Pays) {
    setPaysState(p);
    await AsyncStorage.setItem(CLE_STOCKAGE, p.code);
  }

  return <PaysContext.Provider value={{ pays, setPays }}>{children}</PaysContext.Provider>;
}

export function usePays() {
  const ctx = useContext(PaysContext);
  if (!ctx) throw new Error("usePays doit être utilisé dans <PaysProvider>");
  return ctx;
}