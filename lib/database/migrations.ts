import { schemaMigrations, addColumns, createTable } from "@nozbe/watermelondb/Schema/migrations";

// v5 : ajout de `donnees_supplementaires` (JSON) sur depenses et fournisseurs.
// v6 : création de `product_aliases` (alias appris par le scanner de factures).
export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 5,
      steps: [
        addColumns({
          table: "depenses",
          columns: [{ name: "donnees_supplementaires", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "fournisseurs",
          columns: [{ name: "donnees_supplementaires", type: "string", isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 6,
      steps: [
        createTable({
          name: "product_aliases",
          columns: [
            { name: "remote_id", type: "string", isOptional: true },
            { name: "user_id", type: "string" },
            { name: "produit_id", type: "string" },
            { name: "alias", type: "string" },
            { name: "alias_normalise", type: "string" },
            { name: "source", type: "string" },
            { name: "confiance", type: "number", isOptional: true },
            { name: "cree_le", type: "number" },
            { name: "synchronise", type: "boolean" },
          ],
        }),
      ],
    },
  ],
});
