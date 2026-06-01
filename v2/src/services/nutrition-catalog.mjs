import fs from "fs";
import path from "path";
import { NUTRITION_MEALS_DIR } from "../config/paths.mjs";
import { slugifyId } from "../lib/ids.mjs";

function mealPath(id) {
  return path.join(NUTRITION_MEALS_DIR, `${id}.json`);
}

export function loadCatalog() {
  if (!fs.existsSync(NUTRITION_MEALS_DIR)) fs.mkdirSync(NUTRITION_MEALS_DIR, { recursive: true });
  const files = fs.readdirSync(NUTRITION_MEALS_DIR).filter((f) => f.endsWith(".json"));
  const items = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(NUTRITION_MEALS_DIR, file), "utf-8");
      items.push(JSON.parse(raw));
    } catch { /* skip corrupt files */ }
  }
  return { items: items.sort((a, b) => (a.name || "").localeCompare(b.name || "")) };
}

export function loadMeal(id) {
  const p = mealPath(id);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; }
}

export function saveMeal(item) {
  if (!fs.existsSync(NUTRITION_MEALS_DIR)) fs.mkdirSync(NUTRITION_MEALS_DIR, { recursive: true });
  item.updated_at = new Date().toISOString();
  fs.writeFileSync(mealPath(item.id), JSON.stringify(item, null, 2), "utf-8");
  return item;
}

export function deleteMeal(id) {
  const p = mealPath(id);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

export function normalizeMeal(input, existingId = null) {
  const name = (input.name || input.description || "").toString().trim();
  if (!name) return null;

  const id = existingId || input.id || slugifyId(name, "meal");

  return {
    id,
    kind:             input.kind || "meal",
    category:         input.category || "meal",
    name,
    alias:            input.alias || null,
    meal_type:        input.meal_type || "meal",
    description:      input.description || name,
    notes:            input.notes || "",
    kcal:             Math.max(0, Math.round((input.kcal ?? 0) * 10) / 10),
    protein:          Math.max(0, Math.round((input.protein ?? 0) * 10) / 10),
    carbs:            Math.max(0, Math.round((input.carbs ?? 0) * 10) / 10),
    fat:              Math.max(0, Math.round((input.fat ?? 0) * 10) / 10),
    yield_g:          input.yield_g || null,
    components:       input.components || [],
    addons:           input.addons || [],
    default_addon_ids: input.default_addon_ids || [],
    source:           input.source || "manual",
    created_at:       input.created_at || new Date().toISOString(),
    updated_at:       new Date().toISOString(),
  };
}

export function addOrUpdateItem(catalog, input) {
  const existing = catalog.items.find((i) => i.id === input.id || i.name === input.name);
  const item = normalizeMeal(input, existing?.id);
  if (!item) return null;
  if (existing) item.created_at = existing.created_at;
  saveMeal(item);
  return item;
}

// Legacy compat — catalog.items is built on the fly, no save needed
export function saveCatalog(_catalog) { /* no-op: individual files are saved directly */ }
