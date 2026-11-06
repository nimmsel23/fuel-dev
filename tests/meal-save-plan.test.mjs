import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMealSavePlan, toLoggedAt } from '../src/client/lib/mealSavePlan.js';

const base = { id: null, type: 'lunch', description: 'Reis', notes: '', kcal: '500', protein: '10', carbs: '90', fat: '5', grams: '250', time: '12:30' };

test('neue Mahlzeit: feste ID, Body und optimistischer Eintrag aus denselben Werten', () => {
  const plan = buildMealSavePlan({ form: base, date: '2026-11-06', moveDate: '', newId: () => 'id-1' });
  assert.equal(plan.edit, false);
  assert.equal(plan.body.date, '2026-11-06');
  assert.equal(plan.body.meal.id, 'id-1');
  assert.equal(plan.body.meal.grams, 250);
  assert.equal(plan.body.meal.time, toLoggedAt('2026-11-06', '12:30'));
  assert.equal(plan.optimistic.meal.logged_at, plan.body.meal.time);
});

test('Bearbeiten am selben Tag: optimistische Anzeige, kein new_date', () => {
  const plan = buildMealSavePlan({ form: { ...base, id: 'm1' }, date: '2026-11-06', moveDate: '' });
  assert.equal(plan.edit, true);
  assert.equal(plan.body.meal_id, 'm1');
  assert.equal('new_date' in plan.body, false);
  assert.equal(plan.optimistic.meal_id, 'm1');
});

test('Verschieben auf anderen Tag: new_date gesetzt, keine optimistische Anzeige', () => {
  const plan = buildMealSavePlan({ form: { ...base, id: 'm1' }, date: '2026-11-06', moveDate: '2026-11-07' });
  assert.equal(plan.body.new_date, '2026-11-07');
  assert.equal(plan.optimistic, null);
  assert.equal(plan.body.meal.time, toLoggedAt('2026-11-07', '12:30'));
});

test('moveDate gleich date zaehlt nicht als Verschieben', () => {
  const plan = buildMealSavePlan({ form: { ...base, id: 'm1' }, date: '2026-11-06', moveDate: '2026-11-06' });
  assert.equal('new_date' in plan.body, false);
  assert.ok(plan.optimistic);
});

test('grams leer/ungueltig wird null; toLoggedAt faellt ohne Eingabe auf jetzt zurueck', () => {
  const plan = buildMealSavePlan({ form: { ...base, grams: '' }, date: '2026-11-06', moveDate: '', newId: () => 'x' });
  assert.equal(plan.body.meal.grams, null);
  assert.ok(!Number.isNaN(new Date(toLoggedAt('', '')).getTime()));
});
