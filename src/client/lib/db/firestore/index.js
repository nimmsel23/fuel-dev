/**
 * Firestore Data Layer — Fuel Centre (Multi-User), modularer Barrel.
 *
 * Public-API identisch mit dem früheren monolithischen firestore-db.js —
 * bestehende Importer (firestore-db.js als Barrel, api.cloud.js, hooks,
 * vitalos shell/db) bekommen dieselben Namen zurück.
 */

export * from "./core.js";
export * from "./utils.js";
export * from "./settings.js";
export * from "./nutrition.js";
export * from "./journal.js";
export * from "./supplements.js";
