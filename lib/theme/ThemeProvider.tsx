import React, { createContext, useContext, useState } from "react";
import { useColorScheme } from "react-native";
import { lightColors, darkColors, ThemeColors } from "./colors";

type ThemeMode = "clair" | "sombre" | "auto";

type ThemeContextValue = {
  colors: ThemeColors;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme(); // détecte le réglage du téléphone
  const [mode, setMode] = useState<ThemeMode>("auto");

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
