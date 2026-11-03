export const MACRO_FIELDS = ['kcal', 'protein', 'carbs', 'fat'];
export function normalizeMealMacros(values) {
  return Object.fromEntries(MACRO_FIELDS.map(key => {
    const raw = values[key];
    if (raw == null || (typeof raw === 'string' && !raw.trim())) return [key, null];
    const value = Number(raw);
    if (typeof raw === 'boolean' || !Number.isFinite(value) || value < 0) throw new Error('Nährwerte müssen gültige, nicht negative Zahlen sein.');
    return [key, value];
  }));
}
export function mealMacrosAreValid(values) {
  try { normalizeMealMacros(values); return true; } catch { return false; }
}

export function missingMealMacros(meals) {
  const missing = Object.fromEntries(MACRO_FIELDS.map(key => [key, 0]));
  for (const meal of meals || []) {
    for (const key of MACRO_FIELDS) {
      const raw = meal[key];
      if (raw == null || (typeof raw === 'string' && !raw.trim()) || typeof raw === 'boolean' || !Number.isFinite(Number(raw)) || Number(raw) < 0) missing[key]++;
    }
  }
  return missing;
}
