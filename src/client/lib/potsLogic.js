import { scaleMeal } from "./mealDetails.js";

// Töpfe: ein gekochtes Gericht (ganzer Topf) + je Tag der gegessene Anteil.
//   pot = { id, name, cooked_on: "YYYY-MM-DD", macros: {kcal,protein,carbs,fat}, micros?, micros_meta?, components?,
//           days: { "YYYY-MM-DD": { fraction: 0..1, meal_id } } }
// Reine Logik ohne Firebase-Import (getestet in tests/pots-logic.test.mjs).

export const PRESETS = [
  { value: 0.25, label: "¼" },
  { value: 1 / 3, label: "⅓" },
  { value: 0.5, label: "½" },
  { value: 2 / 3, label: "⅔" },
  { value: 0.75, label: "¾" },
];

const EPS = 0.005; // unter einem halben Prozent gilt der Topf als leer
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const r1 = (v) => Math.round(v * 10) / 10;

export function eatenFraction(pot) {
  return r4(Object.values(pot.days || {}).reduce((s, d) => s + (Number(d?.fraction) || 0), 0));
}

export function remainingFraction(pot) {
  const rest = r4(1 - eatenFraction(pot));
  return rest < EPS ? 0 : rest;
}

export const isFinished = (pot) => remainingFraction(pot) === 0;

// Was an diesem Tag höchstens eingetragen werden kann: Rest des Topfs + schon eingetragener Anteil des Tages.
export function maxFractionFor(pot, date) {
  return r4(remainingFraction(pot) + (Number(pot.days?.[date]?.fraction) || 0));
}

export function clampFraction(pot, date, fraction) {
  const f = Number(fraction);
  if (!Number.isFinite(f) || f <= 0) return 0;
  const clamped = Math.min(f, maxFractionFor(pot, date));
  return clamped < EPS ? 0 : r4(clamped);
}

export const formatPct = (fraction) => `${Math.round((Number(fraction) || 0) * 100)} %`;

// Tage der Timeline, aufsteigend: Kochtag, alle Tage mit Eintrag, heute (falls ab Kochtag), plus ausdrücklich hinzugefügte.
export function daySlots(pot, today, extra = []) {
  const set = new Set([pot.cooked_on, ...Object.keys(pot.days || {}), ...extra]);
  if (today >= pot.cooked_on) set.add(today);
  return [...set].filter(Boolean).sort();
}

export function scaledMacros(macros, fraction) {
  return {
    kcal: Math.round((macros?.kcal || 0) * fraction),
    protein: r1((macros?.protein || 0) * fraction),
    carbs: r1((macros?.carbs || 0) * fraction),
    fat: r1((macros?.fat || 0) * fraction),
  };
}

// Felder der Tages-Mahlzeit für den gegessenen Anteil (skaliert Makros, Mikros und Zutaten).
export function potMealFields(pot, fraction) {
  const base = {
    ...pot.macros,
    ...(pot.micros ? { micros: pot.micros } : {}),
    ...(pot.micros_meta ? { micros_meta: pot.micros_meta } : {}),
    ...(pot.components ? { components: pot.components } : {}),
  };
  const scaled = scaleMeal(base, fraction);
  return {
    ...scaled,
    ...scaledMacros(pot.macros, fraction),
    type: "meal",
    description: `${pot.name} (${formatPct(fraction)} vom Topf)`,
    notes: "",
    pot_id: pot.id,
    pot_fraction: fraction,
    source: pot.micros_meta?.source || "pot",
  };
}

// Plant eine Tagesänderung: neuer Topf-Stand (optimistisch) + Operation fürs Tages-Log.
// op.kind: "add" (neue Mahlzeit), "patch" (bestehende anpassen), "delete", "none".
export function planDay(pot, date, rawFraction, newMealId) {
  const fraction = clampFraction(pot, date, rawFraction);
  const prev = pot.days?.[date];
  const days = { ...(pot.days || {}) };
  if (fraction === 0) {
    delete days[date];
    return { fraction, date, nextPot: { ...pot, days }, op: prev?.meal_id ? { kind: "delete", mealId: prev.meal_id } : { kind: "none" } };
  }
  const mealId = prev?.meal_id || newMealId;
  days[date] = { fraction, meal_id: mealId };
  return { fraction, date, nextPot: { ...pot, days }, op: { kind: prev?.meal_id ? "patch" : "add", mealId } };
}

// Zeitpunkt der Tages-Mahlzeit: heute = jetzt, sonst Abend des Tages.
export function loggedAtFor(date, today, now = new Date()) {
  return date === today ? now.toISOString() : new Date(`${date}T18:00:00`).toISOString();
}

// Topf bearbeiten: Name/Zutaten/Gesamtwerte übernehmen. Kommt eine neue KI-Schätzung (`extras`), ersetzt sie Mikros/Zutaten;
// ohne sie werden vorhandene Mikros mit dem kcal-Verhältnis mitskaliert (wie der Katalog es bei geänderten Portionen tut).
export function applyPotEdit(pot, { name, ingredients, macros, extras }) {
  const next = { ...pot, name: String(name).trim(), ingredients: String(ingredients || "").trim(), macros };
  if (extras) {
    next.micros = extras.micros;
    next.micros_meta = extras.micros_meta;
    next.components = extras.components;
  } else if (pot.micros && pot.macros?.kcal > 0 && macros.kcal > 0 && macros.kcal !== pot.macros.kcal) {
    const factor = macros.kcal / pot.macros.kcal;
    next.micros = Object.fromEntries(Object.entries(pot.micros).map(([k, v]) => [k, v == null ? null : Math.round(v * factor * 1e4) / 1e4]));
  }
  return next;
}
