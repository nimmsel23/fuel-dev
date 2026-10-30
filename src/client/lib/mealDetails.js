import { normalizeComponents } from "./mealComponents.js";
import { normalizeOmega3 } from "../../shared/config/omega3.mjs";
import { MICRO_KEYS } from "../../shared/config/dach.mjs";

const DETAIL_KEYS = ["grams", "micros", "micros_meta", "components", "source", "source_url", "barcode", "catalog_id"];
export function mealDetails(meal) {
  return Object.fromEntries(DETAIL_KEYS.filter(k => meal[k] !== undefined).map(k => [k, meal[k]]));
}

export function catalogToMeal(item) {
  for (const key of ["kcal", "protein", "carbs", "fat"]) {
    if (item[key] == null || !Number.isFinite(Number(item[key])) || Number(item[key]) < 0) {
      throw new Error("Dieser Katalogeintrag hat keine vollständigen Makros. Bitte ein Foto analysieren oder Werte manuell ergänzen.");
    }
  }
  return {
    ...mealDetails(item),
    description: item.name || item.description,
    ...(item.id ? { catalog_id: item.id } : {}),
    grams: Number(item.yield_g || item.grams) > 0 ? Number(item.yield_g || item.grams) : null,
    ...Object.fromEntries(["kcal", "protein", "carbs", "fat"].map(k => [k, Number(item[k])])),
    source: "catalog",
  };
}

export function scaleMeal(meal, factor) {
  if (!Number.isFinite(factor) || factor <= 0) throw new Error("Ungültige Portionsgröße.");
  const scale = value => Math.round(Number(value) * factor * 1e6) / 1e6;
  return {
    ...meal,
    ...Object.fromEntries(["kcal", "protein", "carbs", "fat", "grams"].filter(k => meal[k] != null).map(k => [k, scale(meal[k])])),
    ...(meal.micros ? { micros: Object.fromEntries(Object.entries(meal.micros).map(([k, v]) => [k, v == null ? null : scale(v)])) } : {}),
    ...(meal.micros_meta ? { micros_meta: { ...meal.micros_meta, scaling_factor: (meal.micros_meta.scaling_factor || 1) * factor } } : {}),
    ...(meal.components ? { components: meal.components.map(c => ({ ...c, ...Object.fromEntries(["amount_g", "kcal", "protein", "carbs", "fat"].filter(k => c[k] != null).map(k => [k, scale(c[k])])) })) } : {}),
  };
}

export function scanToMeal(result) {
  if (!result?.macros) throw new Error("Konnte keine Makros erkennen.");
  const micros = normalizeOmega3(Object.fromEntries(MICRO_KEYS.filter(k => result.micros?.[k] != null && Number.isFinite(Number(result.micros[k])) && Number(result.micros[k]) >= 0)
    .map(k => [k, Number(result.micros[k])])));
  const grams = Number(result.grams) > 0 ? Number(result.grams) : null;
  const macros = Object.fromEntries(["kcal", "protein", "carbs", "fat"].map(k => {
    const value = Number(result.macros[k] ?? 0);
    if (!Number.isFinite(value) || value < 0) throw new Error("Die Analyse enthält ungültige Nährwerte. Bitte erneut versuchen.");
    return [k, value];
  }));
  return {
    description: result.name || "Gescannte Mahlzeit", grams, ...macros, source: "gemini",
    ...(Object.keys(micros).length ? { micros } : {}),
    micros_meta: { source: "gemini", method: "meal_estimate", reference_grams: grams, scaling_factor: 1, resolved_at: new Date().toISOString() },
    ...(Array.isArray(result.components) && result.components.length ? { components: normalizeComponents(result.components) } : {}),
  };
}
