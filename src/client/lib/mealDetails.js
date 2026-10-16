import { MICRO_KEYS } from "../../shared/config/dach.mjs";

const DETAIL_KEYS = ["grams", "micros", "micros_meta", "components", "source", "source_url", "barcode"];
export function mealDetails(meal) {
  return Object.fromEntries(DETAIL_KEYS.filter(k => meal[k] !== undefined).map(k => [k, meal[k]]));
}

export function scaleMeal(meal, factor) {
  if (!Number.isFinite(factor) || factor <= 0) throw new Error("Ungültige Portionsgröße.");
  const scale = value => Math.round(Number(value) * factor * 1e6) / 1e6;
  return {
    ...meal,
    ...Object.fromEntries(["kcal", "protein", "carbs", "fat", "grams"].filter(k => meal[k] != null).map(k => [k, scale(meal[k])])),
    ...(meal.micros ? { micros: Object.fromEntries(Object.entries(meal.micros).map(([k, v]) => [k, scale(v)])) } : {}),
    ...(meal.micros_meta ? { micros_meta: { ...meal.micros_meta, scaling_factor: (meal.micros_meta.scaling_factor || 1) * factor } } : {}),
    ...(meal.components ? { components: meal.components.map(c => ({ ...c, ...(c.amount_g != null ? { amount_g: scale(c.amount_g) } : {}) })) } : {}),
  };
}

export function scanToMeal(result) {
  if (!result?.macros) throw new Error("Konnte keine Makros erkennen.");
  const micros = Object.fromEntries(MICRO_KEYS.filter(k => result.micros?.[k] != null && Number.isFinite(Number(result.micros[k])) && Number(result.micros[k]) >= 0)
    .map(k => [k, Number(result.micros[k])]));
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
    ...(Array.isArray(result.components) && result.components.length ? { components: result.components } : {}),
  };
}
