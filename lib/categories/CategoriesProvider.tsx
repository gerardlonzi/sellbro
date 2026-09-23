import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import { obtenirUserId } from "@/lib/auth/userCache";

const CLE_STOCKAGE = "boutika_categories";
const CATEGORIES_PAR_DEFAUT = ["Hygiène", "Alimentation", "Boissons", "Autre"];

// Les catégories vivent en local (AsyncStorage, lecture instantanée et dispo
// hors ligne) ET dans la table Supabase `categories` (persistance serveur,
// retrouvées après réinstallation ou sur un autre appareil). Chaque ajout /
// suppression est poussé vers Supabase en arrière-plan ; au chargement, les
// catégories distantes sont fusionnées dans la liste locale.

type CategoriesContextValue = {
  categories: string[];
  ajouterCategorie: (nom: string) => Promise<void>;
  supprimerCategorie: (nom: string) => Promise<void>;
};

const CategoriesContext = createContext<CategoriesContextValue | null>(null);

// Insère en gardant "Autre" en dernière position.
function insererAvantAutre(liste: string[], nom: string): string[] {
  const indexAutre = liste.indexOf("Autre");
  return indexAutre === -1 ? [...liste, nom] : [...liste.slice(0, indexAutre), nom, ...liste.slice(indexAutre)];
}

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<string[]>(CATEGORIES_PAR_DEFAUT);

  useEffect(() => {
    (async () => {
      // 1) Local d'abord (instantané, hors ligne).
      const json = await AsyncStorage.getItem(CLE_STOCKAGE);
      const locales: string[] = json ? JSON.parse(json) : CATEGORIES_PAR_DEFAUT;
      setCategories(locales);

      // 2) Puis fusion avec le serveur (silencieux si hors ligne).
      try {
        const userId = await obtenirUserId();
        if (!userId) return;
        const { data } = await supabase.from("categories").select("nom").eq("user_id", userId);
        if (!data) return;
        // Réconciliation : les catégories créées HORS LIGNE (locales mais
        // absentes du serveur) sont poussées maintenant.
        const distantes = new Set(data.map((l) => l.nom));
        const manquantes = locales.filter((n) => !distantes.has(n) && !CATEGORIES_PAR_DEFAUT.includes(n));
        if (manquantes.length > 0) {
          await supabase
            .from("categories")
            .upsert(manquantes.map((nom) => ({ user_id: userId, nom })), { onConflict: "user_id,nom" });
        }
        const fusionnees = data.reduce(
          (liste, ligne) => (liste.includes(ligne.nom) ? liste : insererAvantAutre(liste, ligne.nom)),
          locales
        );
        if (fusionnees.length !== locales.length) {
          setCategories(fusionnees);
          await AsyncStorage.setItem(CLE_STOCKAGE, JSON.stringify(fusionnees));
        }
      } catch {
        // Hors ligne : la liste locale fait foi, la fusion se fera plus tard.
      }
    })();
  }, []);

  async function ajouterCategorie(nom: string) {
    const propre = nom.trim();
    if (!propre || categories.includes(propre)) return;
    const nouvelles = insererAvantAutre(categories, propre);
    setCategories(nouvelles);
    await AsyncStorage.setItem(CLE_STOCKAGE, JSON.stringify(nouvelles));
    // Persistance serveur en arrière-plan (ignore le doublon via l'unique
    // (user_id, nom) ; silencieux hors ligne — rejoué à la prochaine ouverture
    // grâce à la fusion ci-dessus... en sens inverse : on pousse aussi les
    // locales manquantes au chargement).
    try {
      const userId = await obtenirUserId();
      if (userId) {
        await supabase.from("categories").upsert({ user_id: userId, nom: propre }, { onConflict: "user_id,nom" });
      }
    } catch {}
  }

  async function supprimerCategorie(nom: string) {
    const nouvelles = categories.filter((c) => c !== nom);
    setCategories(nouvelles);
    await AsyncStorage.setItem(CLE_STOCKAGE, JSON.stringify(nouvelles));
    try {
      const userId = await obtenirUserId();
      if (userId) {
        await supabase.from("categories").delete().eq("user_id", userId).eq("nom", nom);
      }
    } catch {}
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
