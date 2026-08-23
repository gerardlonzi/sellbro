import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";

import { schema } from "./schema";

import Produit from "./models/Produit";
import Vente from "./models/Vente";
import Achat from "./models/Achat";
import CreanceDette from "./models/CreanceDette";

const adapter = new SQLiteAdapter({
  schema,
});

export const database = new Database({
  adapter,
  modelClasses: [
    Produit,
    Vente,
    Achat,
    CreanceDette,
  ],
});