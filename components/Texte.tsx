import { forwardRef } from "react";
import {
  Text as RNText,
  TextInput as RNTextInput,
  StyleSheet,
  TextProps,
  TextInputProps,
} from "react-native";
import { familleDepuisPoids } from "@/lib/theme/typography";

// Remplaçants de <Text> et <TextInput> qui appliquent la police de l'app en
// respectant le `fontWeight` demandé (400/500/600/700/800 → bonne famille).
// Importés à la place de ceux de react-native : le reste du code ne change pas.
function styleAvecPolice(style: any) {
  const plat = StyleSheet.flatten(style) ?? {};
  if (plat.fontFamily) return style;
  const { fontWeight, ...reste } = plat as any;
  return [reste, { fontFamily: familleDepuisPoids(fontWeight), fontWeight: undefined }];
}

export const Text = forwardRef<RNText, TextProps>(function Text({ style, ...props }, ref) {
  return <RNText ref={ref} {...props} style={styleAvecPolice(style)} />;
});

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput({ style, ...props }, ref) {
  return <RNTextInput ref={ref} {...props} style={styleAvecPolice(style)} />;
});
export type TextInput = RNTextInput;
