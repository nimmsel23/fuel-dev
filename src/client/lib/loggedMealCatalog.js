import { mealDetails } from "./mealDetails.js";
const normalize = name => String(name || "").trim().toLowerCase().replace(/\s+/g, " ");

// Runs inside the log transaction, including durable offline replay. Its stable
// ID and the log receipt keep retries from duplicating entries or use counts.
export function catalogFromLoggedMeal(items, meal) {
  if (!meal.description || meal.catalog_id) return items;
  const next = [...items];
  const idx = next.findIndex(item => normalize(item.name) === normalize(meal.description));
  const now = meal.logged_at || meal.time;
  if (idx >= 0) {
    const current = next[idx];
    next[idx] = {
      ...current, use_count: (current.use_count || 0) + 1, last_used_at: now, updated_at: now,
      ...(!current.micros && meal.micros ? { micros: meal.micros, micros_meta: meal.micros_meta || null } : {}),
      ...(!current.components?.length && meal.components?.length ? { components: meal.components } : {}),
    };
  } else {
    next.push({
      ...mealDetails(meal), id: `catalog_${meal.id}`, kind: "meal", category: meal.type || "meal", meal_type: meal.type || "meal",
      name: meal.description, description: meal.description, notes: meal.notes || "",
      kcal: meal.kcal || 0, protein: meal.protein || 0, carbs: meal.carbs || 0, fat: meal.fat || 0,
      yield_g: meal.grams || meal.components?.reduce((sum, c) => sum + (Number(c.amount_g) || 0), 0) || null,
      source: meal.source || "logged", use_count: 1, last_used_at: now, created_at: now, updated_at: now,
    });
  }
  return next;
}
