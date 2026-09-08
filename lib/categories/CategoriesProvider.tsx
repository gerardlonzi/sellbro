import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CLE_STOCKAGE = "boutika_categories";
const CATEGORIES_PAR_DEFAUT = ["Hygiène", "Alimentation", "Boissons", "Autre"];

type CategoriesContextValue = {
  categories: string[];
  ajouterCategorie: (nom: string) => Promise<void>;
  supprimerCategorie: (nom: string) => Promise<void>;
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
    // Insère la nouvelle catégorie AVANT "Autre" (qui reste toujours en dernier).
    const indexAutre = categories.indexOf("Autre");
    const nouvelles =
      indexAutre === -1
        ? [...categories, propre]
        : [...categories.slice(0, indexAutre), propre, ...categories.slice(indexAutre)];
    setCategories(nouvelles);
    await AsyncStorage.setItem(CLE_STOCKAGE, JSON.stringify(nouvelles));
  }

  async function supprimerCategorie(nom: string) {
    const nouvelles = categories.filter((c) => c !== nom);
    setCategories(nouvelles);
    await AsyncStorage.setItem(CLE_STOCKAGE, JSON.stringify(nouvelles));
  }

  return (
    <CategoriesContext.Provider value={{ categories, ajouterCategorie, supprimerCategorie }}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error("useCategories doit être utilisé dans <CategoriesProvider>");
  return ctx;
}