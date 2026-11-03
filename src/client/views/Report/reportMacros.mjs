const KEYS = ['kcal', 'protein', 'carbs', 'fat'];
export function macroValue(raw) {
  if (raw == null || (typeof raw === 'string' && !raw.trim()) || typeof raw === 'boolean') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
export function sumMeals(meals) {
  return Object.fromEntries(KEYS.map(key => {
    const values = (meals || []).map(meal => macroValue(meal[key]));
    return [key, values.length && values.every(value => value !== null) ? values.reduce((a, b) => a + b, 0) : null];
  }));
}
export function macroSplit({ protein, carbs, fat }) {
  if ([protein, carbs, fat].some(value => macroValue(value) === null)) return null;
  const p = protein * 4, c = carbs * 4, f = fat * 9, sum = p + c + f;
  return sum > 0 ? { protein: Math.round(p / sum * 100), carbs: Math.round(c / sum * 100), fat: Math.round(f / sum * 100) } : null;
}
export function averageMealsByDay(days) {
  const nonempty = days.filter(meals => meals.length > 0);
  const totals = sumMeals(nonempty.flat());
  return Object.fromEntries(KEYS.map(key => [key, totals[key] == null ? null : totals[key] / nonempty.length]));
}
export function displayMacro(value, precision = 1) {
  const number = macroValue(value);
  if (number === null) return '—';
  const factor = 10 ** precision;
  return String(Math.round(number * factor) / factor);
}
