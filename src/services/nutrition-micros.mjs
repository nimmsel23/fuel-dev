import { getMealMicros, upsertMealMicros, getAllMealMicros } from "./nutrition-db.mjs";

export const MICRO_KEYS = [
  "vitamin_b12_ug", "calcium_mg", "iron_mg", "vitamin_d_ug", "vitamin_e_mg",
  "folate_ug", "magnesium_mg", "zinc_mg", "sodium_mg", "potassium_mg",
];

export function zeroMicros() {
  return Object.fromEntries(MICRO_KEYS.map((k) => [k, 0]));
}

// Lookup meal micros by name (case-insensitive, SQLite handles it)
export function getMicrosForMeal(mealName) {
  if (!mealName) return null;
  return getMealMicros(mealName);
}

// Save Gemini-estimated micros for a meal
export function saveMicrosForMeal(mealName, micros, source = "gemini") {
  upsertMealMicros(mealName, micros, source);
}

export function listAllMealMicros() {
  return getAllMealMicros();
}
