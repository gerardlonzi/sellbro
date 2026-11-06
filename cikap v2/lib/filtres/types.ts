export type OptionFiltre = { valeur: string; labelCle: string };

export type ConfigFiltre = {
  tri?: OptionFiltre[];
  statut?: OptionFiltre[];
  paiement?: OptionFiltre[];
  avecPeriode?: boolean;
  avecMontant?: boolean;
};

export type ValeursFiltre = {
  tri: string;
  statut: string;
  paiement: string;
  periode: string;
  dateDebut: string;
  dateFin: string;
  montantMin: string;
  montantMax: string;
};

export const VALEURS_FILTRE_VIDES: ValeursFiltre = {
  tri: "", statut: "tous", paiement: "tous", periode: "tous",
  dateDebut: "", dateFin: "", montantMin: "", montantMax: "",
};