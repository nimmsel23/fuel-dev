/**
 * Firestore Utils — Datums-Helpers + Mikronährstoff-Konstanten
 */

export const MICRO_KEYS = [
  "vitamin_a_ug", "vitamin_d_ug", "vitamin_e_mg", "vitamin_k_ug",
  "vitamin_c_mg", "vitamin_b1_mg", "vitamin_b2_mg", "vitamin_b3_mg",
  "vitamin_b5_mg", "vitamin_b6_mg", "vitamin_b7_ug", "folate_ug", "vitamin_b12_ug",
  "calcium_mg", "phosphorus_mg", "magnesium_mg", "iron_mg", "zinc_mg",
  "selenium_ug", "iodine_ug", "potassium_mg", "sodium_mg",
  "omega3_mg",
];

export function zeroMicros() {
  return Object.fromEntries(MICRO_KEYS.map((k) => [k, 0]));
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function localToday() { return todayISO(); }

export function randomId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

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
