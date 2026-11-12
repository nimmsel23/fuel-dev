/**
 * Firestore Utils — Datums-Helpers + Mikronährstoff-Konstanten
 */

import { todayISO, formatLocalDate, shiftLocalISO, datesEndingAt } from "../../../../shared/utils/validation.mjs";
import { MICRO_KEYS } from "../../../../shared/config/dach.mjs";
import { calendarDay, datesOfISOWeek, isoWeekOf } from "../../calendarDay.js";

export { todayISO, formatLocalDate, shiftLocalISO, datesEndingAt, MICRO_KEYS };

export function zeroMicros() {
  return Object.fromEntries(MICRO_KEYS.map((k) => [k, 0]));
}

export function localToday() { return calendarDay(); }

export function getWeekDates(year, week) {
  return datesOfISOWeek(year, week);
}

// ISO-8601-Woche aus einem YYYY-MM-DD-Datum. Kalendertage sind Europe/Vienna:
// toISOString() auf Mitternacht verschiebt dort jeden Tag um eins nach hinten.
export function dateToISOWeek(dateStr) {
  return isoWeekOf(dateStr);
}
