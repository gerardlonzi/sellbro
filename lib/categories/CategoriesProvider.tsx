import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CLE_STOCKAGE = "boutika_categories";
const CATEGORIES_PAR_DEFAUT = ["Hygiène", "Alimentation", "Boissons", "Autre"];

type CategoriesContextValue = {
  categories: string[];
  ajouterCategorie: (nom: string) => Promise<void>;
};

const CategoriesContext = createContext<CategoriesContextValue | null>(null);

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<string[]>(CATEGORIES_PAR_DEFAUT);

  useEffect(() => {
    AsyncStorage.getItem(CLE_STOCKAGE).then((json) => {
      if (json) setCategories(JSON.parse(json));
    });
  }, []);

  async function ajouterCategorie(nom: string) {
    const propre = nom.trim();
    if (!propre || categories.includes(propre)) return;
    const nouvelles = [...categories, propre];
    setCategories(nouvelles);
    await AsyncStorage.setItem(CLE_STOCKAGE, JSON.stringify(nouvelles));
  }

  return (
    <CategoriesContext.Provider value={{ categories, ajouterCategorie }}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error("useCategories doit être utilisé dans <CategoriesProvider>");
  return ctx;
}