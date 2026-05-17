import { readJsonFile, writeJsonFile } from "../lib/file-io.mjs";
import { slugifyId } from "../lib/ids.mjs";
import { NUTRITION_CATALOG_PATH } from "../config/paths.mjs";

const DEFAULTS = {
  version: 1,
  updated_at: new Date().toISOString(),
  items: [],
};

export function loadCatalog() {
  const catalog = readJsonFile(NUTRITION_CATALOG_PATH, DEFAULTS);
  if (!catalog.items) catalog.items = [];
  return catalog;
}

export function saveCatalog(catalog) {
  catalog.updated_at = new Date().toISOString();
  writeJsonFile(NUTRITION_CATALOG_PATH, catalog);
}

export function normalizeNutritionItem(input, existingItems = []) {
  const name = (input.name || input.description || "").toString().trim();
  if (!name) return null;

  const id = input.id || slugifyId(name, "meal");
  const existing = existingItems.find((i) => i.id === id);
  if (existing && !input.id) return null;

  return {
    id,
    kind: input.kind || "meal",
    category: input.category || "meal",
    name,
    meal_type: input.meal_type || "meal",
    description: input.description || name,
    notes: input.notes || "",
    kcal: Math.max(0, Math.round((input.kcal ?? 0) * 10) / 10),
    protein: Math.max(0, Math.round((input.protein ?? 0) * 10) / 10),
    carbs: Math.max(0, Math.round((input.carbs ?? 0) * 10) / 10),
    fat: Math.max(0, Math.round((input.fat ?? 0) * 10) / 10),
    yield_g: input.yield_g || null,
    components: input.components || [],
    addons: input.addons || [],
    default_addon_ids: input.default_addon_ids || [],
    source: input.source || "manual",
    created_at: input.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function addOrUpdateItem(catalog, input) {
  const item = normalizeNutritionItem(input, catalog.items);
  if (!item) return null;

  const idx = catalog.items.findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    item.created_at = catalog.items[idx].created_at;
    catalog.items[idx] = item;
  } else {
    catalog.items.push(item);
  }

  return item;
}
