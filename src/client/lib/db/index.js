// fuel-dev own Unified DB wrapper
// Imports the entire fitness-dev database layer (auth, habits, general journal, sessions).
// @fitness-db zeigt je nach Channel (vite.config.js = lokal/Coach, vite.config.cjs =
// Cloud/Client) auf die passende fitness-Variante (lokal vs. Firestore) — siehe dort.
export * from "@fitness-db";

// Selective overrides from fuel-dev's own database layer
export {
  getMealsHistory,
  getSupplementsHistory,
  getNutritionLog,
  getNutritionLogsInRange,
  getSupplementsCatalog,
  getSupplementLog,
  getSupplementStats,
  MICRO_KEYS,
  zeroMicros,
} from "./firestore/index.js";

export {
  getNotes as getNutritionNotes,
  saveNotes as saveNutritionNotes,
  getNutritionNotesHistory,
} from "./firestore/notes.js";
