// Fonds d'image premium : une version sombre et une version claire de chaque
// fond, choisies selon le mode de l'app (clair / sombre / automatique).
const FONDS = {
  welcome: { dark: require("@/assets/bg-welcome-dark.jpg"), light: require("@/assets/bg-welcome-light.jpg") },
  paywall: { dark: require("@/assets/bg-paywall-dark.jpg"), light: require("@/assets/bg-paywall-light.jpg") },
  plan: { dark: require("@/assets/bg-plan-dark.jpg"), light: require("@/assets/bg-plan-light.jpg") },
};

export function fondPremium(nom: keyof typeof FONDS, isDark: boolean) {
  return FONDS[nom][isDark ? "dark" : "light"];
}
