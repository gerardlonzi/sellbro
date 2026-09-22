import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { lightColors, darkColors, ThemeColors } from "./colors";

type ThemeMode = "clair" | "sombre" | "auto";

type ThemeContextValue = {
  colors: ThemeColors;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
};

const CLE_THEME = "theme_mode";

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme(); // détecte le réglage du téléphone
  const [mode, setModeState] = useState<ThemeMode>("auto");

  // Restaure le choix de l'utilisateur au démarrage — sinon le réglage du
  // téléphone reprend le dessus à chaque réouverture de l'app.
  useEffect(() => {
    AsyncStorage.getItem(CLE_THEME).then((sauvegarde) => {
      if (sauvegarde === "clair" || sauvegarde === "sombre" || sauvegarde === "auto") {
        setModeState(sauvegarde);
      }
    });
  }, []);

  function setMode(nouveau: ThemeMode) {
    setModeState(nouveau);
    AsyncStorage.setItem(CLE_THEME, nouveau).catch(() => {});
  }

  const isDark = mode === "auto" ? systemScheme === "dark" : mode === "sombre";
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ colors, mode, setMode, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme doit être utilisé à l'intérieur de <ThemeProvider>");
  return ctx;
}
