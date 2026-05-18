import path from "path";
import fs from "fs";
import { NUTRITION_DIR } from "../config/paths.mjs";

const MICROS_CATALOG_PATH = path.join(NUTRITION_DIR, "micros-catalog.json");

export function loadMicrosCatalog() {
  if (fs.existsSync(MICROS_CATALOG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(MICROS_CATALOG_PATH, "utf-8"));
    } catch {
      return { items: [] };
    }
  }
  return { items: [] };
}

export function saveMicrosCatalog(catalog) {
  fs.writeFileSync(MICROS_CATALOG_PATH, JSON.stringify(catalog, null, 2), "utf-8");
}

/**
 * Add or update micronutrient data for a meal
 * meal: { name, description, ... }
 * micros: { vitamin_b12_ug, calcium_mg, iron_mg, ... }
 */
export function addOrUpdateMicroItem(catalog, meal, micros) {
  if (!meal || !meal.name) {
    return null;
  }

  const existingIndex = catalog.items.findIndex(
    (item) => item.name === meal.name && item.description === meal.description
  );

  const item = {
    id: existingIndex >= 0 ? catalog.items[existingIndex].id : `micro_${Date.now()}`,
    name: meal.name,
    description: meal.description,
    vitamin_b12_ug: micros.vitamin_b12_ug || 0,
    calcium_mg: micros.calcium_mg || 0,
    iron_mg: micros.iron_mg || 0,
    vitamin_d_ug: micros.vitamin_d_ug || 0,
    vitamin_e_mg: micros.vitamin_e_mg || 0,
    folate_ug: micros.folate_ug || 0,
    magnesium_mg: micros.magnesium_mg || 0,
    zinc_mg: micros.zinc_mg || 0,
    sodium_mg: micros.sodium_mg || 0,
    potassium_mg: micros.potassium_mg || 0,
    created_at: existingIndex >= 0 ? catalog.items[existingIndex].created_at : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    catalog.items[existingIndex] = item;
  } else {
    catalog.items.push(item);
  }

  return item;
}

/**
 * Get micronutrient data for a meal
 */
export function getMicroItem(name, description) {
  const catalog = loadMicrosCatalog();
  return catalog.items.find(
    (item) => item.name === name && item.description === description
  );
}

export default { loadMicrosCatalog, saveMicrosCatalog, addOrUpdateMicroItem, getMicroItem };
