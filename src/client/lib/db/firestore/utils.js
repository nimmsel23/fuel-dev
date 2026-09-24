/**
 * Firestore Utils — Datums-Helpers + Mikronährstoff-Konstanten
 */

import { todayISO } from "../../../../shared/utils/validation.mjs";
import { MICRO_KEYS } from "../../../../shared/config/dach.mjs";

export { todayISO, MICRO_KEYS };

export function zeroMicros() {
  return Object.fromEntries(MICRO_KEYS.map((k) => [k, 0]));
}

export function localToday() { return todayISO(); }

export function getWeekDates(year, week) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(ISOweekStart);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

// ISO-8601-Woche aus einem YYYY-MM-DD-Datum (Donnerstag-der-Woche-Methode) —
// Kehrfunktion zu getWeekDates(), gebraucht um bei einem Log-Write zu wissen,
// welcher Wochen-Mikros-Cache (siehe nutrition.js getWeeklyMicros) invalidiert
// werden muss.
export function dateToISOWeek(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7; // Montag=0..Sonntag=6
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target - firstThursday;
  const week = 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
  return { year: target.getFullYear(), week };
}
