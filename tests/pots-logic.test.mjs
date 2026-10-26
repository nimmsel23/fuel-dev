import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  eatenFraction, remainingFraction, isFinished, clampFraction, maxFractionFor,
  daySlots, potMealFields, planDay, loggedAtFor, formatPct,
} from '../src/client/lib/potsLogic.js';

const pot = (days = {}) => ({
  id: 'p1', name: 'Jasmins speckige Reiseier', cooked_on: '2026-10-26',
  macros: { kcal: 2400, protein: 120, carbs: 260, fat: 90 }, days,
});

test('Anteile: gegessen, Rest, aufgegessen', () => {
  const p = pot({ '2026-10-26': { fraction: 0.75, meal_id: 'a' } });
  assert.equal(eatenFraction(p), 0.75);
  assert.equal(remainingFraction(p), 0.25);
  assert.equal(isFinished(p), false);
  assert.equal(isFinished(pot({ a: { fraction: 0.5 }, b: { fraction: 0.5 } })), true);
});

test('Drittel + Drittel + Drittel gilt als aufgegessen (Rundung)', () => {
  const third = 1 / 3;
  assert.equal(isFinished(pot({ a: { fraction: third }, b: { fraction: third }, c: { fraction: third } })), true);
});

test('clampFraction: nie mehr als der Rest, der Tag selbst zählt nicht doppelt', () => {
  const p = pot({ '2026-10-26': { fraction: 0.75, meal_id: 'a' } });
  assert.equal(clampFraction(p, '2026-10-27', 0.5), 0.25);
  assert.equal(clampFraction(p, '2026-10-26', 1), 1);
  assert.equal(maxFractionFor(p, '2026-10-26'), 1);
  assert.equal(clampFraction(p, '2026-10-27', -1), 0);
  assert.equal(clampFraction(p, '2026-10-27', 'abc'), 0);
});

test('daySlots: Kochtag, Einträge und heute, sortiert; vor dem Kochtag kein "heute"', () => {
  const p = pot({ '2026-10-27': { fraction: 0.1, meal_id: 'x' } });
  assert.deepEqual(daySlots(p, '2026-10-28'), ['2026-10-26', '2026-10-27', '2026-10-28']);
  assert.deepEqual(daySlots(p, '2026-10-20'), ['2026-10-26', '2026-10-27']);
  assert.deepEqual(daySlots(p, '2026-10-26', ['2026-10-29']), ['2026-10-26', '2026-10-27', '2026-10-29']);
});

test('potMealFields: Makros skaliert, Beschreibung mit Anteil, Verknüpfung zum Topf', () => {
  const f = potMealFields({ ...pot(), micros: { magnesium: 100 }, micros_meta: { source: 'gemini', scaling_factor: 1 } }, 0.75);
  assert.equal(f.kcal, 1800);
  assert.equal(f.protein, 90);
  assert.equal(f.description, 'Jasmins speckige Reiseier (75 % vom Topf)');
  assert.equal(f.pot_id, 'p1');
  assert.equal(f.pot_fraction, 0.75);
  assert.equal(f.micros.magnesium, 75);
  assert.equal(f.micros_meta.scaling_factor, 0.75);
});

test('planDay: neuer Tag → add, bestehender → patch mit derselben Meal-ID, 0 → delete', () => {
  const add = planDay(pot(), '2026-10-26', 0.75, 'm1');
  assert.deepEqual(add.op, { kind: 'add', mealId: 'm1' });
  assert.deepEqual(add.nextPot.days['2026-10-26'], { fraction: 0.75, meal_id: 'm1' });

  const patch = planDay(add.nextPot, '2026-10-26', 0.5, 'ignoriert');
  assert.deepEqual(patch.op, { kind: 'patch', mealId: 'm1' });
  assert.equal(patch.nextPot.days['2026-10-26'].fraction, 0.5);

  const del = planDay(patch.nextPot, '2026-10-26', 0, 'x');
  assert.deepEqual(del.op, { kind: 'delete', mealId: 'm1' });
  assert.equal('2026-10-26' in del.nextPot.days, false);

  assert.deepEqual(planDay(pot(), '2026-10-27', 0, 'x').op, { kind: 'none' });
});

test('planDay: über den Rest hinaus wird gekappt, Ursprungs-Topf bleibt unverändert', () => {
  const p = pot({ '2026-10-26': { fraction: 0.75, meal_id: 'a' } });
  const plan = planDay(p, '2026-10-27', 0.5, 'b');
  assert.equal(plan.fraction, 0.25);
  assert.equal(Object.keys(p.days).length, 1);
});

test('loggedAtFor: heute = jetzt, sonst Abend des Tages', () => {
  const now = new Date('2026-10-26T10:00:00Z');
  assert.equal(loggedAtFor('2026-10-26', '2026-10-26', now), now.toISOString());
  assert.equal(new Date(loggedAtFor('2026-10-25', '2026-10-26', now)).getHours(), 18);
  assert.equal(formatPct(1 / 3), '33 %');
});
