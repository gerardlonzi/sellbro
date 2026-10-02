export type ThemeColors = typeof lightColors;


export const lightColors = {
  background: "#f7f7f7",
  surface: "#ffffff",
  border: "#e8e8e8",
  textPrimary: "#181815",
  textSecondary: "#5C5B54",
  textMuted: "#898880",
  accent: "#4c3cc0",
  accentBg: "#4b3cc025",
  success: "#1a9a65",
  successBg: "#DFF3EB",
  warning: "#7A4A0A",
  warningBg: "#F8EBD2",
  danger: "#A02C2C",
  dangerBg: "#FBE7E7",
  info: "#2563EB",
  infoBg: "#DBEAFE",
  pro: "#372F80",
  proBg: "#ECEAFD",
  proFill: "#7F77DD",
  onPro: "#FFFFFF",
  borderPro: "#A9A2EA",

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
  background: "#121212",
  surface: "#1E1E1C",
  border: "#333330",
  textPrimary: "#F1EFE8",
  textSecondary: "#B4B2A9",
  textMuted: "#888780",
  accent: "#25af93",
  accentBg: "#0C3B33",
  success: "#5DCAA5",
  successBg: "#085041",
  warning: "#FAC775",
  warningBg: "#633806",
  danger: "#F09595",
  dangerBg: "#791F1F",
  info: "#60A5FA",
  infoBg: "#1E3A5F",
  pro: "#CECBF6",
  proBg: "#26215C",
  proFill: "#8179eb",
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

