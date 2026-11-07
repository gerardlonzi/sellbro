import { ReactNode, useEffect, useState } from "react";
import { Keyboard, Platform, View, ViewStyle, StyleProp } from "react-native";

// Hauteur du clavier (0 s'il est fermé).
export function useHauteurClavier(): number {
  const [h, setH] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const a = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", (e) => setH(e.endCoordinates?.height ?? 0));
    const b = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setH(0));
    return () => { a.remove(); b.remove(); };
  }, []);
  return h;
}

// Barre du bas (Enregistrer / Soumettre) : quand le clavier s'ouvre, le
// formulaire remonte pour garder le champ visible, mais cette barre reste à sa
// place d'origine (le clavier passe devant) au lieu de monter avec lui.
export function BarreFixe({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const h = useHauteurClavier();
  return <View style={[style, h > 0 ? { transform: [{ translateY: h }] } : null]}>{children}</View>;
}
