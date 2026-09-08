
import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import { schema } from "./schema";
import Produit from "./models/Produit";
import Vente from "./models/Vente";
import Achat from "./models/Achat";
import CreanceDette from "./models/CreanceDette";
import Fournisseur from "./models/Fournisseur";
import Depense from "./models/Depense";
import MouvementStock from "./models/MouvementStock";
import Facture from "./models/Facture";
import FactureLigne from "./models/FactureLigne";
import JournalActivite from "./models/JournalActivite";

const adapter = new SQLiteAdapter({ schema, jsi: false });

export const database = new Database({
  adapter,
  modelClasses: [Produit, Vente, Achat, CreanceDette, Fournisseur, Depense, MouvementStock, Facture, FactureLigne, JournalActivite],
});