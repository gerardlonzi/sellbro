// Configuration CENTRALE du scanner : aucun seuil ne doit être hardcodé
// ailleurs (matching, écran de validation, edge function).

export const CONFIG_SCANNER = {
  // Seuils de confiance du matching produit.
  seuils: {
    // >= auto : correspondance acceptée sans confirmation.
    auto: 0.9,
    // >= confirmation : proposée, l'utilisateur confirme.
    confirmation: 0.7,
    // < confirmation : « produit non reconnu », aucune présélection.
  },

  // Prétraitement image avant envoi à l'IA : assez de résolution pour lire
  // les caractères d'un ticket, sans envoyer une photo de 5 Mo.
  image: {
    largeurMax: 2000,
    compression: 0.8,
    tailleMaxOctets: 2 * 1024 * 1024, // au-delà on recompresse plus fort
  },

  // Matching fuzzy : distance maximale normalisée (0 = identique, 1 = rien
  // en commun) pour rester candidat.
  fuzzy: {
    distanceMax: 0.45,
    nbCandidatsMax: 5,
  },

  // Analytics interne (§22) : types d'événements consignés dans le journal.
  analytics: {
    typeScan: "scan_facture",
  },
} as const;
