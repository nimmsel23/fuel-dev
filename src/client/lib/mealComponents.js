// Zieht eine Grammzahl aus dem freitextlichen qty-Feld ("200g roh", "0,5 l").
// JS-Port von fuel/catalog_lookup.py::_amount_to_grams — beide Channels sollen
// components identisch normalisieren.
const _GRAMS_RE = /(\d+(?:[.,]\d+)?)\s*(g|gr|gramm|kg|ml|l)\b/i;
export function amountToGrams(qtyText) {
  if (!qtyText) return null;
  const m = String(qtyText).match(_GRAMS_RE);
  if (!m) return null;
  let val = parseFloat(m[1].replace(",", "."));
  const unit = m[2].toLowerCase();
  if (unit === "kg" || unit === "l") val *= 1000;
  return Math.round(val * 10) / 10;
}

const _r1 = (v) => Math.round((Number(v) || 0) * 10) / 10;

// Vertex-Komponenten ({name, qty, kcal, protein, carbs, fat}) in die stabile
// Form bringen, die auch die lokale CLI schreibt. per_100g/micros_source sind
// Platzhalter für die spätere Zutaten-Mikro-Auflösung.
export function normalizeComponents(components) {
  return (Array.isArray(components) ? components : [])
    .filter((c) => c && typeof c === "object")
    .map((c) => {
      const qtyText = c.qty_text || c.qty || c.quantity || "";
      return {
        name: c.name || "?",
        qty_text: qtyText,
        amount_g: Number.isFinite(Number(c.amount_g)) && Number(c.amount_g) > 0 ? Number(c.amount_g) : amountToGrams(qtyText),
        kcal: _r1(c.kcal),
        protein: _r1(c.protein),
        carbs: _r1(c.carbs),
        fat: _r1(c.fat),
        per_100g: c.per_100g || null,
        micros_source: c.micros_source || null,
      };
    });
}

// yield_g = Summe der geparsten Zutaten-Gramm (null wenn nichts parsbar).
export function sumYieldG(normComponents) {
  const total = (normComponents || []).reduce((s, c) => s + (c.amount_g || 0), 0);
  return total > 0 ? Math.round(total * 10) / 10 : null;
}
