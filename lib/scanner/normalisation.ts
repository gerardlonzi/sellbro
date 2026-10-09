// Normalisation des libellés pour le matching (niveau 2) :
// « RUIZ », « ruiz », « RUI-Z », « RUI Z » → même forme comparable.
// Gère : casse, accents, espaces, tirets, ponctuation, caractères spéciaux.

export function normaliserLibelle(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents (diacritiques combinants)
    .replace(/[^a-z0-9]+/g, " ") // ponctuation, tirets, symboles → espace
    .trim()
    .replace(/\s+/g, " ");
}

// Forme COMPACTE (sans espaces) : « RUIZ 25KG » → « ruiz25kg ». Sert au
// niveau contexte pour comparer les quantités/unités collées au nom.
export function normaliserCompact(texte: string): string {
  return normaliserLibelle(texte).replace(/\s/g, "");
}

// Extrait la contenance d'un libellé : « RUIZ 25KG » → { valeur: 25, unite: "kg" }.
// Supporte kg, g, l, cl, ml, sac, sachet, carton, pcs…
export function extraireContenance(texte: string): { valeur: number; unite: string } | null {
  const m = normaliserLibelle(texte).match(/(\d+(?:[.,]\d+)?)\s*(kg|g|l|cl|ml|sac|sachet|carton|pcs|piece|pieces|paquet|boite|btl|bouteille)\b/);
  if (!m) return null;
  return { valeur: parseFloat(m[1].replace(",", ".")), unite: m[2] };
}

// Distance de Levenshtein normalisée : 0 = identique, 1 = rien en commun.
export function distanceNormalisee(a: string, b: string): number {
  const x = normaliserCompact(a);
  const y = normaliserCompact(b);
  if (x === y) return 0;
  if (x.length === 0 || y.length === 0) return 1;

  const lignes = x.length + 1;
  const colonnes = y.length + 1;
  let precedente = new Array<number>(colonnes);
  let courante = new Array<number>(colonnes);
  for (let j = 0; j < colonnes; j++) precedente[j] = j;
  for (let i = 1; i < lignes; i++) {
    courante[0] = i;
    for (let j = 1; j < colonnes; j++) {
      courante[j] = Math.min(
        precedente[j] + 1,
        courante[j - 1] + 1,
        precedente[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1)
      );
    }
    [precedente, courante] = [courante, precedente];
  }
  return precedente[y.length] / Math.max(x.length, y.length);
}

// Recouvrement de tokens : « huile dinor » vs « dinor 5l » partagent « dinor ».
// 0 = aucun token commun, 1 = tous les tokens de `a` sont dans `b`.
export function recouvrementTokens(a: string, b: string): number {
  const tokensA = normaliserLibelle(a).split(" ").filter((t) => t.length > 1);
  const tokensB = new Set(normaliserLibelle(b).split(" "));
  if (tokensA.length === 0) return 0;
  const communs = tokensA.filter((t) => tokensB.has(t)).length;
  return communs / tokensA.length;
}
