/**
 * Firestore Utils — Datums-Helpers + Mikronährstoff-Konstanten
 */

import { todayISO, formatLocalDate, shiftLocalISO, datesEndingAt } from "../../../../shared/utils/validation.mjs";
import { MICRO_KEYS } from "../../../../shared/config/dach.mjs";

export { todayISO, formatLocalDate, shiftLocalISO, datesEndingAt, MICRO_KEYS };

export function zeroMicros() {
  return Object.fromEntries(MICRO_KEYS.map((k) => [k, 0]));
}

export function localToday() { return todayISO(); }

function mondayOfISOWeek(year, week) {
  const jan4 = new Date(year, 0, 4, 12, 0, 0, 0);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (week - 1) * 7);
  return monday;
}

export function getWeekDates(year, week) {
  const monday = mondayOfISOWeek(year, week);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return formatLocalDate(day);
  });
}

// ISO-8601-Woche aus einem YYYY-MM-DD-Datum (Donnerstag-der-Woche-Methode) —
// Kehrfunktion zu getWeekDates(), gebraucht um bei einem Log-Write zu wissen,
// welcher Wochen-Mikros-Cache (siehe nutrition.js getWeeklyMicros) invalidiert
// werden muss. Kalendertage bleiben lokal: toISOString() auf Mitternacht
// verschiebt in Europe/Vienna jeden Tag um eins nach hinten.
export function dateToISOWeek(dateStr) {
  const [year, month, day] = String(dateStr).split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const isoYear = thursday.getFullYear();
  const week1Monday = mondayOfISOWeek(isoYear, 1);
  const week = 1 + Math.round((monday - week1Monday) / 86400000 / 7);
  return { year: isoYear, week };
}
