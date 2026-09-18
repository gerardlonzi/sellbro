import { useEffect, useState } from "react";
import { Image, ImageStyle, StyleProp } from "react-native";
import { estImageLocale } from "@/lib/storage/images";
import { imageDepuisCache, telechargerEnCache } from "@/lib/storage/cacheImages";

// <Image> avec cache disque : une image distante déjà téléchargée reste visible
// HORS LIGNE, même après fermeture/redémarrage de l'app. En ligne et pas encore
// en cache : affiche l'URL directement et met en cache en arrière-plan.
export function ImageCachee({ uri, style, ...props }: { uri: string; style?: StyleProp<ImageStyle> } & Omit<React.ComponentProps<typeof Image>, "source" | "style">) {
  const [source, setSource] = useState(uri);

  useEffect(() => {
    let actif = true;
    (async () => {
      if (!uri || estImageLocale(uri)) {
        setSource(uri);
        return;
      }
      const cache = await imageDepuisCache(uri);
      if (cache) {
        if (actif) setSource(cache);
        return;
      }
      // Pas encore en cache : affiche l'URL (en ligne) et télécharge en fond.
      if (actif) setSource(uri);
      const chemin = await telechargerEnCache(uri);
      if (actif && chemin) setSource(chemin);
    })();
    return () => {
      actif = false;
    };
  }, [uri]);

  return <Image {...props} source={{ uri: source }} style={style} />;
}
