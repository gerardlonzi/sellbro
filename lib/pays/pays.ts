export type Pays = { code: string; indicatif: string; drapeau: string; nom: string; longueurs?: number[] };

// Uniquement les pays supportés par SasPay (Mobile Money) — chaque pays a ses
// opérateurs dans lib/paiement/reseaux.ts.
export const PAYS: Pays[] = [
    { code: "CM", indicatif: "+237", drapeau: "🇨🇲", nom: "Cameroun" },
    { code: "CI", indicatif: "+225", drapeau: "🇨🇮", nom: "Côte d'Ivoire" },
    { code: "SN", indicatif: "+221", drapeau: "🇸🇳", nom: "Sénégal" },
    { code: "BJ", indicatif: "+229", drapeau: "🇧🇯", nom: "Bénin" },
    { code: "BF", indicatif: "+226", drapeau: "🇧🇫", nom: "Burkina Faso" },
    { code: "ML", indicatif: "+223", drapeau: "🇲🇱", nom: "Mali" },
    { code: "NE", indicatif: "+227", drapeau: "🇳🇪", nom: "Niger" },
    { code: "TG", indicatif: "+228", drapeau: "🇹🇬", nom: "Togo" },
    { code: "GN", indicatif: "+224", drapeau: "🇬🇳", nom: "Guinée" },
    { code: "CD", indicatif: "+243", drapeau: "🇨🇩", nom: "République démocratique du Congo" },
    { code: "GH", indicatif: "+233", drapeau: "🇬🇭", nom: "Ghana" },
    { code: "KE", indicatif: "+254", drapeau: "🇰🇪", nom: "Kenya" },
    { code: "MW", indicatif: "+265", drapeau: "🇲🇼", nom: "Malawi" },
    { code: "NG", indicatif: "+234", drapeau: "🇳🇬", nom: "Nigeria" },
    { code: "RW", indicatif: "+250", drapeau: "🇷🇼", nom: "Rwanda" },
    { code: "TZ", indicatif: "+255", drapeau: "🇹🇿", nom: "Tanzanie" },
    { code: "UG", indicatif: "+256", drapeau: "🇺🇬", nom: "Ouganda" },
    { code: "ZM", indicatif: "+260", drapeau: "🇿🇲", nom: "Zambie" },
];
export const PAYS_PAR_DEFAUT = PAYS[0]; // Cameroun
