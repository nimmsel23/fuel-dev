import Database from "better-sqlite3";
import { NUTRITION_DB_PATH } from "../config/paths.mjs";
import { MICRO_KEYS } from "../../shared/config/dach.mjs";

let db = null;

function getDb() {
  if (!db) {
    db = new Database(NUTRITION_DB_PATH);
    db.pragma("journal_mode = WAL");
    initDb();
  }
  return db;
}

function initDb() {
  const db = getDb();

  // Wger ingredient cache — macros per 100g
  db.exec(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id         INTEGER PRIMARY KEY,
      wger_id    INTEGER UNIQUE,
      name       TEXT NOT NULL,
      brand      TEXT,
      kcal       REAL,
      protein    REAL,
      carbs      REAL,
      fat        REAL,
      fiber      REAL,
      sodium_mg  REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ingredients_wger_id ON ingredients(wger_id);
    CREATE INDEX IF NOT EXISTS idx_ingredients_name    ON ingredients(name COLLATE NOCASE);
  `);

  // Meal micronutrient profiles — Gemini-estimated absolute values per meal as eaten
  db.exec(`
    CREATE TABLE IF NOT EXISTS meal_micros (
      id               INTEGER PRIMARY KEY,
      meal_name        TEXT UNIQUE NOT NULL,
      vitamin_b12_ug   REAL DEFAULT 0,
      calcium_mg       REAL DEFAULT 0,
      iron_mg          REAL DEFAULT 0,
      vitamin_d_ug     REAL DEFAULT 0,
      vitamin_e_mg     REAL DEFAULT 0,
      folate_ug        REAL DEFAULT 0,
      magnesium_mg     REAL DEFAULT 0,
      zinc_mg          REAL DEFAULT 0,
      sodium_mg        REAL DEFAULT 0,
      potassium_mg     REAL DEFAULT 0,
      vitamin_c_mg     REAL DEFAULT 0,
      vitamin_b6_mg    REAL DEFAULT 0,
      vitamin_b1_mg    REAL DEFAULT 0,
      vitamin_b2_mg    REAL DEFAULT 0,
      phosphorus_mg    REAL DEFAULT 0,
      selenium_ug      REAL DEFAULT 0,
      iodine_ug        REAL DEFAULT 0,
      source           TEXT DEFAULT 'gemini',
      created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_meal_micros_name ON meal_micros(meal_name COLLATE NOCASE);
  `);

  // Migrate existing DBs: alle MICRO_KEYS (Quelle: shared/config/dach.mjs)
  // + kcal idempotent nachziehen — neue Nährstoffe landen automatisch hier,
  // ohne diese Liste manuell zu pflegen. ALTER TABLE wirft bei bereits
  // vorhandener Spalte, das ist der erwartete No-Op-Pfad.
  const newCols = ["kcal REAL", ...MICRO_KEYS.map((k) => `${k} REAL DEFAULT 0`)];
  for (const col of newCols) {
    try { db.exec(`ALTER TABLE meal_micros ADD COLUMN ${col}`); } catch { /* column exists */ }
  }

  // Tages-Log als normalisierte Rows statt JSON-Blob-pro-Tag. Grund: der
  // Firestore-Sync (firestored push_fuel) pusht bisher den kompletten
  // Tages-JSON-Blob als EIN Dokument — Firestore-merge=True ersetzt
  // Array-Felder ('meals') komplett statt sie zu mergen, was am 2026-07-23
  // zu echtem Datenverlust führte (App-Einträge durch lokalen CLI-Log
  // überschrieben). Mit einer Row pro Meal (id = Primary Key) kann ein
  // künftiger Row-basierter Sync einzelne Einträge upserten, ohne
  // gleichzeitig bestehende fremde Rows zu zerstören. JSON-Dateien bleiben
  // vorerst parallel bestehen (Migration/Fallback), SQLite ist die neue
  // Source of Truth für den Server-Schreibpfad.
  db.exec(`
    CREATE TABLE IF NOT EXISTS meals (
      id          TEXT PRIMARY KEY,
      date        TEXT NOT NULL,
      catalog_id  TEXT,
      type        TEXT DEFAULT 'meal',
      description TEXT NOT NULL,
      notes       TEXT DEFAULT '',
      kcal        REAL DEFAULT 0,
      protein     REAL DEFAULT 0,
      carbs       REAL DEFAULT 0,
      fat         REAL DEFAULT 0,
      micros_json TEXT,
      logged_at   TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date);

    CREATE TABLE IF NOT EXISTS daily_water (
      date       TEXT PRIMARY KEY,
      water_ml   REAL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// ── Meals (Tages-Log, normalisiert) ───────────────────────────────────────────

export function upsertMeal(meal) {
  const db = getDb();
  db.prepare(`
    INSERT INTO meals (id, date, catalog_id, type, description, notes, kcal, protein, carbs, fat, micros_json, logged_at)
    VALUES (@id, @date, @catalog_id, @type, @description, @notes, @kcal, @protein, @carbs, @fat, @micros_json, @logged_at)
    ON CONFLICT(id) DO UPDATE SET
      date = excluded.date, catalog_id = excluded.catalog_id, type = excluded.type,
      description = excluded.description, notes = excluded.notes,
      kcal = excluded.kcal, protein = excluded.protein, carbs = excluded.carbs, fat = excluded.fat,
      micros_json = excluded.micros_json, logged_at = excluded.logged_at,
      updated_at = CURRENT_TIMESTAMP
  `).run({
    id: meal.id,
    date: meal.date,
    catalog_id: meal.catalog_id ?? null,
    type: meal.type ?? "meal",
    description: meal.description,
    notes: meal.notes ?? "",
    kcal: meal.kcal ?? 0,
    protein: meal.protein ?? 0,
    carbs: meal.carbs ?? 0,
    fat: meal.fat ?? 0,
    micros_json: meal.micros ? JSON.stringify(meal.micros) : null,
    logged_at: meal.logged_at ?? meal.time ?? null,
  });
}

export function deleteMeal(id) {
  return getDb().prepare("DELETE FROM meals WHERE id = ?").run(id);
}

export function getMealsForDate(date) {
  const rows = getDb().prepare("SELECT * FROM meals WHERE date = ? ORDER BY logged_at, id").all(date);
  return rows.map((r) => ({
    ...r,
    micros: r.micros_json ? JSON.parse(r.micros_json) : undefined,
    micros_json: undefined,
  }));
}

export function upsertWater(date, waterMl) {
  getDb().prepare(`
    INSERT INTO daily_water (date, water_ml) VALUES (?, ?)
    ON CONFLICT(date) DO UPDATE SET water_ml = excluded.water_ml, updated_at = CURRENT_TIMESTAMP
  `).run(date, waterMl);
}

export function getWater(date) {
  const row = getDb().prepare("SELECT water_ml FROM daily_water WHERE date = ?").get(date);
  return row ? row.water_ml : 0;
}

// ── Ingredients (wger cache) ──────────────────────────────────────────────────

export function upsertIngredient(wgerId, data) {
  return getDb().prepare(`
    INSERT INTO ingredients (wger_id, name, brand, kcal, protein, carbs, fat, fiber, sodium_mg)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(wger_id) DO UPDATE SET
      name = excluded.name, brand = excluded.brand,
      kcal = excluded.kcal, protein = excluded.protein,
      carbs = excluded.carbs, fat = excluded.fat,
      fiber = excluded.fiber, sodium_mg = excluded.sodium_mg,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    wgerId, data.name, data.brand || null,
    data.kcal ?? null, data.protein ?? null,
    data.carbs ?? null, data.fat ?? null,
    data.fiber ?? null, data.sodium_mg ?? null
  );
}

export function getIngredientByWgerId(wgerId) {
  return getDb().prepare("SELECT * FROM ingredients WHERE wger_id = ?").get(wgerId) || null;
}

// ── Meal micros ───────────────────────────────────────────────────────────────

const MICRO_COLS = MICRO_KEYS;

export function upsertMealMicros(mealName, kcal, micros, source = "gemini") {
  const db = getDb();
  const vals = MICRO_COLS.map((c) => micros[c] ?? 0);
  const sets = MICRO_COLS.map((c) => `${c} = excluded.${c}`).join(", ");

  db.prepare(`
    INSERT INTO meal_micros (meal_name, kcal, ${MICRO_COLS.join(", ")}, source)
    VALUES (?, ?, ${MICRO_COLS.map(() => "?").join(", ")}, ?)
    ON CONFLICT(meal_name) DO UPDATE SET
      kcal = excluded.kcal, ${sets}, source = excluded.source, updated_at = CURRENT_TIMESTAMP
  `).run(mealName, kcal, ...vals, source);
}

export function getMealMicros(mealName) {
  return getDb()
    .prepare("SELECT * FROM meal_micros WHERE meal_name = ? COLLATE NOCASE")
    .get(mealName) || null;
}

export function getAllMealMicros() {
  return getDb().prepare("SELECT * FROM meal_micros ORDER BY meal_name").all();
}

export default {
  getDb, upsertIngredient, getIngredientByWgerId, upsertMealMicros, getMealMicros, getAllMealMicros,
  upsertMeal, deleteMeal, getMealsForDate, upsertWater, getWater,
};
