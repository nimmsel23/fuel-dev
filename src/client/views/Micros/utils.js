import { DACH } from "../../../shared/config/dach.mjs";

// Einzige Quelle ist shared/config/dach.mjs — hier nur noch UI-Form ableiten,
// damit ein neuer Nährstoff (z.B. Bor) nicht mehr an mehreren Stellen
// nachgetragen werden muss.
export const NUTRIENTS = Object.entries(DACH).map(([key, { label, unit }]) => ({ key, label, unit }));

export function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return {
    year: d.getFullYear(),
    week: 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7),
  };
}

export function lastNWeeks(n) {
  const weeks = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weeks.push(getISOWeek(d));
  }
  return weeks;
}

export function pctColor(pct) {
  if (pct == null) return { bg: "rgba(30,41,59,0.4)", text: "#475569" };
  if (pct >= 90)   return { bg: "#16a34a",            text: "#fff" };
  if (pct >= 50)   return { bg: "#d97706",            text: "#fff" };
  return               { bg: "#dc2626",            text: "#fff" };
}
