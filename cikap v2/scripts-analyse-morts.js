// Analyse ponctuelle : détecte les modules lib/ et components/ jamais importés.
const fs = require("fs");
const path = require("path");

const fichiers = [];
for (const r of ["app", "components", "lib"]) {
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f).replace(/\\/g, "/");
      const s = fs.statSync(p);
      if (s.isDirectory()) walk(p);
      else if (/\.(tsx|ts|jsx|js)$/.test(f)) fichiers.push(p);
    }
  })(r);
}
const contenus = new Map(fichiers.map((f) => [f, fs.readFileSync(f, "utf8")]));

const morts = fichiers.filter((f) => {
  if (f.startsWith("app/")) return false; // routes expo-router : référencées implicitement
  const base = path.basename(f).replace(/\.(tsx|ts|jsx|js)$/, "");
  const motif = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp("[\"'`]" + "[^\"'`]*" + motif + "[\"'`]");
  for (const [g, c] of contenus) {
    if (g !== f && re.test(c)) return false;
  }
  return true;
});

console.log("MORTS:");
morts.forEach((f) => console.log(" -", f));
