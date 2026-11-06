export type ThemeColors = typeof lightColors;


export const lightColors = {
  background: "#F4F7F6",
  surface: "#FFFFFF",
  surfaceElevee: "#FFFFFF",
  border: "#E2E9E6",
  textPrimary: "#0E1A16",
  textSecondary: "#47585A",
  textMuted: "#7B8B86",
  // Teal de marque (logo Cikap #25af93), version assombrie pour le contraste
  // du texte blanc sur les boutons.
  accent: "#14917A",
  accentClair: "#25AF93",
  accentBg: "#E3F5F0",
  ombre: "#0B2A22",
  overlay: "rgba(8,20,17,0.55)",
  success: "#1a9a65",
  successBg: "#DFF3EB",
  warning: "#7A4A0A",
  warningBg: "#F8EBD2",
  danger: "#A02C2C",
  dangerBg: "#FBE7E7",
  info: "#2563EB",
  infoBg: "#DBEAFE",
  pro: "#4B3FBF",
  proBg: "#EFECFF",
  proFill: "#6C5CE7",
  onPro: "#FFFFFF",
  borderPro: "#B9B1F5",

  // Tons des puces d'icônes (pastilles colorées). Chaque ton est une paire :
  // `puceX` pour le trait, `puceXBg` pour le fond. Les teintes reprennent
  // celles déjà employées ailleurs dans l'app (successBg, warningBg, infoBg…)
  // plutôt qu'une gamme nouvelle, pour que l'ensemble reste cohérent.
  puceViolet: "#4C3CC0",
  puceVioletBg: "#ECEAFD",
  puceLilas: "#6D4AA8",
  puceLilasBg: "#F2E9FB",
  puceBleu: "#1D4ED8",
  puceBleuBg: "#E3EDFB",
  puceVert: "#0E6A51",
  puceVertBg: "#DFF3EB",
  puceAmbre: "#8A6D00",
  puceAmbreBg: "#FFF3CC",
  puceRose: "#A32C6B",
  puceRoseBg: "#FCE7F1",
};

export const darkColors = {
  background: "#0C1412",
  surface: "#141F1C",
  surfaceElevee: "#1A2824",
  border: "#25332F",
  textPrimary: "#EEF5F2",
  textSecondary: "#A9BBB5",
  textMuted: "#7A8C86",
  accent: "#2CC3A3",
  accentClair: "#25AF93",
  accentBg: "#0F3A32",
  ombre: "#000000",
  overlay: "rgba(0,0,0,0.65)",
  success: "#5DCAA5",
  successBg: "#085041",
  warning: "#FAC775",
  warningBg: "#633806",
  danger: "#F09595",
  dangerBg: "#791F1F",
  info: "#60A5FA",
  infoBg: "#1E3A5F",
  pro: "#D3CEFF",
  proBg: "#241F5E",
  proFill: "#7F70F0",
  onPro: "#ffffff",
  borderPro: "#908adc",

  // Mêmes tons en sombre : fond profond, trait clair — la convention déjà
  // suivie par successBg / warningBg / dangerBg ci-dessus.
  puceViolet: "#CECBF6",
  puceVioletBg: "#26215C",
  puceLilas: "#D6C2F0",
  puceLilasBg: "#3A2A57",
  puceBleu: "#93C5FD",
  puceBleuBg: "#1E3A5F",
  puceVert: "#5DCAA5",
  puceVertBg: "#085041",
  puceAmbre: "#FAC775",
  puceAmbreBg: "#4A3506",
  puceRose: "#F0A6C8",
  puceRoseBg: "#4E1B36",
};

