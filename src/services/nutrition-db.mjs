import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { NUTRITION_DIR } from "../config/paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(NUTRITION_DIR, "nutrition.db");

let db = null;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initDb();
  }
  return db;
}

function initDb() {
  const db = getDb();

  // Ingredients: base foods with micronutrients
  db.exec(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY,
      wger_id INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      brand TEXT,

      -- Macros (per 100g)
      kcal REAL,
      protein REAL,
      carbs REAL,
      fat REAL,
      fiber REAL,

      -- Micros (per 100g)
      sodium_mg REAL,
      potassium_mg REAL,
      calcium_mg REAL,
      iron_mg REAL,
      magnesium_mg REAL,
      zinc_mg REAL,

      -- Vitamins (per 100g)
      vitamin_a_ug REAL,
      vitamin_b12_ug REAL,
      vitamin_d_ug REAL,
      vitamin_e_mg REAL,
      folate_ug REAL,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Meals: composed dishes
  db.exec(`
    CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,

      -- Aggregated macros
      kcal REAL,
      protein REAL,
      carbs REAL,
      fat REAL,
      fiber REAL,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Meal components: link meals to ingredients with quantities
  db.exec(`
    CREATE TABLE IF NOT EXISTS meal_components (
      id INTEGER PRIMARY KEY,
      meal_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      quantity_g REAL NOT NULL,

      FOREIGN KEY (meal_id) REFERENCES meals(id),
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
    );
  `);

  // Daily logs: user's meals per day
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_logs (
      id INTEGER PRIMARY KEY,
      date TEXT UNIQUE NOT NULL,

      -- Aggregated macros
      kcal REAL DEFAULT 0,
      protein REAL DEFAULT 0,
      carbs REAL DEFAULT 0,
      fat REAL DEFAULT 0,
      fiber REAL DEFAULT 0,

      -- Aggregated micros
      sodium_mg REAL DEFAULT 0,
      potassium_mg REAL DEFAULT 0,
      calcium_mg REAL DEFAULT 0,
      iron_mg REAL DEFAULT 0,
      zinc_mg REAL DEFAULT 0,
      vitamin_b12_ug REAL DEFAULT 0,
      vitamin_d_ug REAL DEFAULT 0,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ingredients_wger_id ON ingredients(wger_id);
    CREATE INDEX IF NOT EXISTS idx_meal_components_meal_id ON meal_components(meal_id);
    CREATE INDEX IF NOT EXISTS idx_meal_components_ingredient_id ON meal_components(ingredient_id);
    CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(date);
  `);
}

/**
 * Add or update ingredient from wger data
 */
export function upsertIngredient(wgerId, data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO ingredients (wger_id, name, brand, kcal, protein, carbs, fat, fiber, sodium_mg)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(wger_id) DO UPDATE SET
      name = ?,
      brand = ?,
      kcal = ?,
      protein = ?,
      carbs = ?,
      fat = ?,
      fiber = ?,
      sodium_mg = ?,
      updated_at = CURRENT_TIMESTAMP
  `);

  return stmt.run(
    wgerId,
    data.name,
    data.brand || null,
    data.kcal || null,
    data.protein || null,
    data.carbs || null,
    data.fat || null,
    data.fiber || null,
    data.sodium_mg || null,
    // Duplicates for ON CONFLICT
    data.name,
    data.brand || null,
    data.kcal || null,
    data.protein || null,
    data.carbs || null,
    data.fat || null,
    data.fiber || null,
    data.sodium_mg || null
  );
}

/**
 * Get ingredient by wger_id
 */
export function getIngredient(wgerId) {
  const db = getDb();
  return db.prepare("SELECT * FROM ingredients WHERE wger_id = ?").get(wgerId);
}

/**
 * Create meal and its components
 */
export function createMeal(name, description, components) {
  const db = getDb();

  // Start transaction
  const transaction = db.transaction(() => {
    // Insert meal
    const mealStmt = db.prepare(`
      INSERT INTO meals (name, description, kcal, protein, carbs, fat)
      VALUES (?, ?, 0, 0, 0, 0)
    `);
    const mealResult = mealStmt.run(name, description);
    const mealId = mealResult.lastInsertRowid;

    // Insert components
    const compStmt = db.prepare(`
      INSERT INTO meal_components (meal_id, ingredient_id, quantity_g)
      VALUES (?, ?, ?)
    `);

    let totalKcal = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0, totalFiber = 0;

    for (const comp of components) {
      const ing = getIngredient(comp.wger_id);
      if (!ing) continue;

      compStmt.run(mealId, ing.id, comp.quantity_g);

      // Aggregate macros
      const multiplier = comp.quantity_g / 100;
      totalKcal += (ing.kcal || 0) * multiplier;
      totalProtein += (ing.protein || 0) * multiplier;
      totalCarbs += (ing.carbs || 0) * multiplier;
      totalFat += (ing.fat || 0) * multiplier;
      totalFiber += (ing.fiber || 0) * multiplier;
    }

    // Update meal with aggregated macros
    db.prepare(`
      UPDATE meals SET kcal = ?, protein = ?, carbs = ?, fat = ?, fiber = ?
      WHERE id = ?
    `).run(
      Math.round(totalKcal),
      Math.round(totalProtein * 10) / 10,
      Math.round(totalCarbs * 10) / 10,
      Math.round(totalFat * 10) / 10,
      Math.round(totalFiber * 10) / 10,
      mealId
    );

    return mealId;
  });

  return transaction();
}

/**
 * Get meal with all components and micronutrients
 */
export function getMeal(mealId) {
  const db = getDb();

  const meal = db.prepare("SELECT * FROM meals WHERE id = ?").get(mealId);
  if (!meal) return null;

  const components = db
    .prepare(`
      SELECT mc.*, i.* FROM meal_components mc
      JOIN ingredients i ON mc.ingredient_id = i.id
      WHERE mc.meal_id = ?
    `)
    .all(mealId);

  return { ...meal, components };
}

/**
 * Calculate daily totals (macros + micros) for a date
 */
export function calculateDailyTotals(date) {
  const db = getDb();

  // TODO: This would read from nutrition logs and sum up all meals
  // For now, just return structure

  return {
    date,
    macros: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    micros: {
      sodium_mg: 0,
      potassium_mg: 0,
      calcium_mg: 0,
      iron_mg: 0,
      zinc_mg: 0,
      vitamin_b12_ug: 0,
      vitamin_d_ug: 0,
    },
  };
}

export default { getDb, upsertIngredient, getIngredient, createMeal, getMeal, calculateDailyTotals };
