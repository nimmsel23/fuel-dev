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
