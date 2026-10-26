import { test } from 'node:test';
import assert from 'node:assert/strict';
import { persistPlan, planRescale, releaseDay } from '../src/client/lib/potsPersist.js';
import { planDay, applyPotEdit } from '../src/client/lib/potsLogic.js';

const pot = (days = {}) => ({ id: 'p1', name: 'Reiseier', cooked_on: '2026-10-26', macros: { kcal: 2400, protein: 120, carbs: 260, fat: 90 }, days });

// Fake-Abhängigkeiten, die die Reihenfolge der Seiteneffekte mitschreiben.
function fakeDeps({ meals = [] } = {}) {
  const calls = [];
  let counter = 0;
  return {
    calls,
    savePot: async (p) => calls.push(['savePot', structuredClone(p.days)]),
    onPot: (p) => calls.push(['onPot', structuredClone(p.days)]),
    dayMeals: async (date) => { calls.push(['dayMeals', date]); return meals; },
    addMeal: async (date, meal) => calls.push(['addMeal', date, meal]),
    patchMeal: async (date, id, fields) => calls.push(['patchMeal', date, id, fields]),
    deleteMeal: async (date, id) => calls.push(['deleteMeal', date, id]),
    newId: () => `neu${++counter}`,
    today: '2026-10-26',
  };
}

test('Neuer Tagesanteil: erst Topf speichern, dann Mahlzeit mit skalierten Makros anlegen', async () => {
  const deps = fakeDeps();
  await persistPlan(deps, planDay(pot(), '2026-10-26', 0.75, 'm1'));
  assert.deepEqual(deps.calls.map((c) => c[0]), ['savePot', 'addMeal']);
  const meal = deps.calls[1][2];
  assert.equal(meal.id, 'm1');
  assert.equal(meal.kcal, 1800);
  assert.equal(meal.pot_id, 'p1');
  assert.equal(meal.description, 'Reiseier (75 % vom Topf)');
});

test('Bestehende Mahlzeit vorhanden: wird gepatcht, nicht neu angelegt', async () => {
  const deps = fakeDeps({ meals: [{ id: 'm1' }] });
  const base = planDay(pot(), '2026-10-26', 0.75, 'm1').nextPot;
  await persistPlan(deps, planDay(base, '2026-10-26', 0.5, 'x'));
  assert.deepEqual(deps.calls.map((c) => c[0]), ['savePot', 'dayMeals', 'patchMeal']);
  assert.equal(deps.calls[2][2], 'm1');
  assert.equal(deps.calls[2][3].kcal, 1200);
});

test('Mahlzeit im Log gelöscht: Patch wird zu Neuanlage mit frischer ID, Topf wird nachgezogen', async () => {
  const deps = fakeDeps({ meals: [] });
  const base = planDay(pot(), '2026-10-26', 0.75, 'm1').nextPot;
  const result = await persistPlan(deps, planDay(base, '2026-10-26', 0.5, 'x'));
  assert.deepEqual(deps.calls.map((c) => c[0]), ['savePot', 'dayMeals', 'onPot', 'savePot', 'addMeal']);
  assert.equal(deps.calls.at(-1)[2].id, 'neu1');
  assert.equal(result.days['2026-10-26'].meal_id, 'neu1');
});

test('Anteil 0: Mahlzeit wird gelöscht', async () => {
  const deps = fakeDeps();
  const base = planDay(pot(), '2026-10-26', 0.5, 'm1').nextPot;
  await persistPlan(deps, planDay(base, '2026-10-26', 0, 'x'));
  assert.deepEqual(deps.calls.at(-1), ['deleteMeal', '2026-10-26', 'm1']);
});

test('Topf bearbeitet: alle Tagesanteile werden mit neuen Werten gepatcht, Topf nicht erneut gespeichert', async () => {
  const old = pot({ '2026-10-26': { fraction: 0.5, meal_id: 'a' }, '2026-10-27': { fraction: 0.25, meal_id: 'b' } });
  const next = applyPotEdit(old, { name: 'Reiseier extra', ingredients: '', macros: { kcal: 3000, protein: 150, carbs: 300, fat: 100 } });
  const deps = fakeDeps({ meals: [{ id: 'a' }, { id: 'b' }] });
  for (const plan of planRescale(next)) await persistPlan(deps, plan, { saveFirst: false });
  assert.equal(deps.calls.filter((c) => c[0] === 'savePot').length, 0);
  const patches = deps.calls.filter((c) => c[0] === 'patchMeal');
  assert.deepEqual(patches.map((c) => [c[2], c[3].kcal]), [['a', 1500], ['b', 750]]);
  assert.equal(patches[0][3].description, 'Reiseier extra (50 % vom Topf)');
});

test('applyPotEdit: Mikros wandern mit dem kcal-Verhältnis, neue KI-Schätzung ersetzt sie', () => {
  const base = { ...pot(), micros: { magnesium: 100 } };
  const scaled = applyPotEdit(base, { name: ' X ', ingredients: ' y ', macros: { ...base.macros, kcal: 4800 } });
  assert.equal(scaled.micros.magnesium, 200);
  assert.equal(scaled.name, 'X');
  assert.equal(scaled.ingredients, 'y');
  assert.equal(applyPotEdit(base, { name: 'X', macros: base.macros }).micros.magnesium, 100);
  const replaced = applyPotEdit(base, { name: 'X', macros: base.macros, extras: { micros: { magnesium: 7 }, micros_meta: { source: 'gemini' } } });
  assert.equal(replaced.micros.magnesium, 7);
});

test('releaseDay: gibt den Tag nur frei, wenn die Mahlzeit zum Topf-Tag gehört; Verschieben verlegt den Eintrag', () => {
  const p = pot({ '2026-10-26': { fraction: 0.5, meal_id: 'a' } });
  assert.equal(releaseDay(p, '2026-10-26', 'andere'), null);
  assert.equal(releaseDay(p, '2026-10-27', 'a'), null);
  assert.deepEqual(releaseDay(p, '2026-10-26', 'a').days, {});
  // Verschieben: Eintrag wandert mit der neuen Meal-ID des Zieltags; ohne neue ID wird nur freigegeben
  assert.deepEqual(releaseDay(p, '2026-10-26', 'a', '2026-10-28', 'neu').days, { '2026-10-28': { fraction: 0.5, meal_id: 'neu' } });
  assert.deepEqual(releaseDay(p, '2026-10-26', 'a', '2026-10-28').days, {});
  const belegt = pot({ '2026-10-26': { fraction: 0.5, meal_id: 'a' }, '2026-10-28': { fraction: 0.2, meal_id: 'z' } });
  assert.equal(releaseDay(belegt, '2026-10-26', 'a', '2026-10-28', 'neu').days['2026-10-28'].meal_id, 'z');
  assert.equal(belegt.days['2026-10-26'].fraction, 0.5); // Original unverändert
});
