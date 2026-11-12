import { changeLog } from "./cloudLogState.js";

export function logHasVisibleEntries(log) {
  const meals = Array.isArray(log?.meals) ? log.meals : [];
  return meals.length > 0 || Number(log?.water_ml) > 0;
}

// Server-Reihenfolge bleibt (updated_at). Noch nicht geschriebene Outbox-Tage
// stehen davor, damit eine gerade geloggte Mahlzeit oder ein Wasser-Tag in der
// Woche sichtbar ist, bevor das Dokument zurückgelesen wurde.
export function mergeHistoryWithPending(logs, entries = []) {
  const byDate = new Map();
  const ordered = [];
  for (const log of logs || []) {
    if (!log?.date || byDate.has(log.date)) continue;
    byDate.set(log.date, { meals: [], water_ml: 0, ...log, date: log.date });
    ordered.push(log.date);
  }
  const pendingDates = [];
  for (const entry of entries) {
    if (!entry || entry.kind !== "nutrition" || entry.blocked) continue;
    for (const date of [entry.date, entry.command?.new_date]) {
      if (date && !byDate.has(date) && !pendingDates.includes(date)) pendingDates.push(date);
    }
  }
  const dates = [...pendingDates.reverse(), ...ordered];
  const merged = [];
  for (const date of dates) {
    let projected = { meals: [], water_ml: 0, ...(byDate.get(date) || {}), date };
    for (const entry of entries) {
      if (!entry || entry.kind !== "nutrition" || entry.blocked) continue;
      const command = entry.command || {};
      try {
        if (entry.date === date) {
          projected = { ...changeLog("nutrition", projected, command), date };
          if (command.new_date && command.new_date !== date) {
            projected = {
              ...projected,
              meals: (projected.meals || []).filter((meal) => meal.id !== command.meal_id),
            };
          }
        } else if (command.new_date === date && entry.targetMeal) {
          projected = { ...changeLog("nutrition", projected, { meal: entry.targetMeal }), date };
        }
      } catch {
        // Konflikt bleibt der Serverstand; der Replay meldet ihn.
      }
    }
    if (logHasVisibleEntries(projected)) merged.push(projected);
  }
  return merged;
}
