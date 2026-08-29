import { Database } from "@nozbe/watermelondb";
import LokiJSAdapter from "@nozbe/watermelondb/adapters/lokijs";
import { schema } from "./schema";
import Produit from "./models/Produit";
import Vente from "./models/Vente";
import Achat from "./models/Achat";
import CreanceDette from "./models/CreanceDette";

const adapter = new LokiJSAdapter({
  schema,
  useWebWorker: false,
  useIncrementalIndexedDB: true,
  dbName: "boutika",
});

export const database = new Database({
  adapter,
  modelClasses: [Produit, Vente, Achat, CreanceDette],
});