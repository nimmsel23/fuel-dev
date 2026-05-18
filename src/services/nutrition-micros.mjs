import path from "path";
import fs from "fs";
import { NUTRITION_MICROS_CATALOG_PATH } from "../config/paths.mjs";

const MICRO_KEYS = [
  "vitamin_b12_ug", "calcium_mg", "iron_mg", "vitamin_d_ug", "vitamin_e_mg",
  "folate_ug", "magnesium_mg", "zinc_mg", "sodium_mg", "potassium_mg",
];

export function zeroMicros() {
  return Object.fromEntries(MICRO_KEYS.map((k) => [k, 0]));
}

export function loadMicrosCatalog() {
  if (fs.existsSync(NUTRITION_MICROS_CATALOG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(NUTRITION_MICROS_CATALOG_PATH, "utf-8"));
    } catch {
      return { version: 2, items: [] };
    }
  }
  return { version: 2, items: [] };
}

export function saveMicrosCatalog(catalog) {
  catalog.updated_at = new Date().toISOString();
  fs.writeFileSync(NUTRITION_MICROS_CATALOG_PATH, JSON.stringify(catalog, null, 2), "utf-8");
}

// Find ingredient by name or alias (case-insensitive)
export function findIngredient(catalog, name) {
  if (!name) return null;
  const needle = name.toLowerCase().trim();
  return catalog.items.find((item) => {
    if (item.name.toLowerCase() === needle) return true;
    return (item.aliases || []).some((a) => a.toLowerCase() === needle);
  }) || null;
}

// Scale per_100g micros by actual grams consumed
export function scaleMicros(per100g, grams) {
  if (!per100g || !grams || grams <= 0) return zeroMicros();
  const factor = grams / 100;
  return Object.fromEntries(
    MICRO_KEYS.map((k) => [k, Math.round((per100g[k] || 0) * factor * 10) / 10])
  );
}

// Sum micros for a list of { name, grams } components against the catalog
// Returns { micros, matched, unmatched }
export function getMicrosForComponents(components, catalog) {
  const total = zeroMicros();
  const matched = [];
  const unmatched = [];

  for (const comp of components || []) {
    const label = comp.label || comp.name || comp.description || "";
    const grams = comp.grams || comp.quantity_g || 0;
    const ingredient = findIngredient(catalog, label);

    if (ingredient && grams > 0) {
      const scaled = scaleMicros(ingredient.per_100g, grams);
      for (const k of MICRO_KEYS) total[k] = Math.round((total[k] + scaled[k]) * 10) / 10;
      matched.push({ label, grams, ingredient_id: ingredient.id });
    } else {
      unmatched.push({ label, grams, reason: !ingredient ? "not_in_catalog" : "no_grams" });
    }
  }

  return { micros: total, matched, unmatched };
}

// Add or update ingredient in catalog
export function addOrUpdateIngredient(catalog, ingredient) {
  if (!ingredient?.name) return null;

  const existing = catalog.items.findIndex((i) => i.id === ingredient.id || i.name === ingredient.name);
  const item = {
    id: ingredient.id || ingredient.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    name: ingredient.name,
    aliases: ingredient.aliases || [],
    per_100g: Object.fromEntries(MICRO_KEYS.map((k) => [k, ingredient.per_100g?.[k] || 0])),
    source: ingredient.source || "manual",
    notes: ingredient.notes || "",
    created_at: existing >= 0 ? catalog.items[existing].created_at : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (existing >= 0) catalog.items[existing] = item;
  else catalog.items.push(item);

  return item;
}
