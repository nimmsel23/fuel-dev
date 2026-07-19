import { getMealMicros, upsertMealMicros, getAllMealMicros } from "./nutrition-db.mjs";
import { MICRO_KEYS } from "../../shared/config/dach.mjs";

export { MICRO_KEYS };

export function zeroMicros() {
  return Object.fromEntries(MICRO_KEYS.map((k) => [k, 0]));
}

// Lookup meal micros by name (case-insensitive, SQLite handles it)
export function getMicrosForMeal(mealName) {
  if (!mealName) return null;
  return getMealMicros(mealName);
}

// Save Gemini-estimated micros for a meal
export function saveMicrosForMeal(mealName, kcal, micros, source = "gemini") {
  upsertMealMicros(mealName, kcal, micros, source);
}

export function listAllMealMicros() {
  return getAllMealMicros();
}

// Löst die Mikros einer geloggten Mahlzeit auf — per Katalog-Name-Lookup,
// kcal-skaliert auf die tatsächlich geloggte Portion. Cached das Resultat
// direkt am `meal`-Objekt (mutiert in-place), damit Aufrufer das Ergebnis
// beim nächsten Zurückschreiben des Log-Files persistieren können, statt
// bei jedem Read erneut nachzuschlagen (vorher: O(Tage×Mahlzeiten) bei
// jedem Wochen-Request, jetzt einmalig pro Mahlzeit).
export function resolveMealMicros(meal, catalog) {
  if (meal.micros) return meal.micros;

  const catalogEntry = catalog.items.find(
    (i) => (meal.catalog_id && i.id === meal.catalog_id) || i.name === meal.description
  );
  const lookupName = catalogEntry?.name || meal.description;
  const micros = getMicrosForMeal(lookupName);
  if (!micros) return null;

  let factor = 1;
  if (meal.kcal && micros.kcal) factor = meal.kcal / micros.kcal;

  const resolved = {};
  for (const k of MICRO_KEYS) {
    resolved[k] = Math.round((micros[k] || 0) * factor * 10) / 10;
  }
  meal.micros = resolved;
  return resolved;
}

// Summiert die (gecachten) Mikros aller Mahlzeiten eines Tages.
// complete=false heißt: mindestens eine Mahlzeit hat noch keine Mikros
// (Gemini-Schätzung läuft im Hintergrund) — Aufrufer soll das Ergebnis
// dann NICHT als Tages-Cache persistieren, sonst friert eine unvollständige
// Summe dauerhaft ein.
export function computeMealMicroTotals(meals, catalog) {
  const totals = zeroMicros();
  let complete = true;
  for (const meal of meals || []) {
    const micros = resolveMealMicros(meal, catalog);
    if (!micros) { complete = false; continue; }
    for (const k of MICRO_KEYS) {
      totals[k] = Math.round((totals[k] + micros[k]) * 10) / 10;
    }
  }
  return { totals, complete };
}
