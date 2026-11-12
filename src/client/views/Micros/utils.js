import { DACH } from "../../../shared/config/dach.mjs";
import { calendarDay, isoWeekOf, shiftCalendarDay } from "../../lib/calendarDay.js";

// Einzige Quelle ist shared/config/dach.mjs — hier nur noch UI-Form ableiten,
// damit ein neuer Nährstoff (z.B. Bor) nicht mehr an mehreren Stellen
// nachgetragen werden muss.
export const NUTRIENTS = Object.entries(DACH).map(([key, { label, unit }]) => ({ key, label, unit }));

export function getISOWeek(date) {
  const iso = date instanceof Date ? calendarDay(date) : String(date || "");
  return isoWeekOf(iso);
}

export function lastNWeeks(n, now = new Date()) {
  const today = now instanceof Date ? calendarDay(now) : String(now);
  const weeks = [];
  for (let i = n - 1; i >= 0; i -= 1) weeks.push(isoWeekOf(shiftCalendarDay(today, -i * 7)));
  return weeks;
}

export function pctColor(pct) {
  if (pct == null) return { bg: "rgba(30,41,59,0.4)", text: "#475569" };
  if (pct >= 90)   return { bg: "#16a34a",            text: "#fff" };
  if (pct >= 50)   return { bg: "#d97706",            text: "#fff" };
  return               { bg: "#dc2626",            text: "#fff" };
}
