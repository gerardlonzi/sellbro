import { schemaMigrations, addColumns } from "@nozbe/watermelondb/Schema/migrations";

// v5 : ajout de `donnees_supplementaires` (JSON) sur depenses et fournisseurs.
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
  ],
});
