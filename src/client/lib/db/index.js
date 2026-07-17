// fuel-dev own Unified DB wrapper
// Imports the entire fitness-dev database layer (auth, habits, general journal, sessions)
export * from "../../../../../fitness-dev/src/lib/db/index.firestore.js";

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
