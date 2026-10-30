import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogToMeal, mealDetails, scanToMeal, scaleMeal } from '../src/client/lib/mealDetails.js';
import { normalizeComponents, amountToGrams, sumYieldG } from '../src/client/lib/mealComponents.js';

test('scan keeps known nutrients and provenance; unknown/invalid values stay absent', () => {
  const meal = scanToMeal({ name: 'Lunch', grams: 200, macros: { kcal: 300, protein: 20 }, micros: { calcium_mg: 100, vitamin_b12_ug: 0.2, iron_mg: -1, junk: 999 } });
  assert.deepEqual(meal.micros, { calcium_mg: 100, vitamin_b12_ug: 0.2 });
  assert.equal(meal.micros_meta.reference_grams, 200);
  assert.equal(meal.micros_meta.source, 'gemini');
  assert.equal(scanToMeal({ macros: { kcal: 1 } }).micros, undefined);
});

test('portion scaling keeps trace amounts, metadata and ingredient quantities consistent', () => {
  const meal = scanToMeal({ grams: 200, macros: { kcal: 300 }, micros: { vitamin_b12_ug: 0.2 }, components: [{ name: 'Rice', amount_g: 100, per_100g: { kcal: 130 } }] });
  const half = scaleMeal(meal, 0.5);
  assert.equal(half.grams, 100); assert.equal(half.kcal, 150); assert.equal(half.micros.vitamin_b12_ug, 0.1);
  assert.equal(half.components[0].amount_g, 50); assert.equal(half.components[0].per_100g.kcal, 130);
  assert.equal(half.micros_meta.scaling_factor, 0.5);
  assert.equal(meal.components[0].amount_g, 100);
  assert.deepEqual(mealDetails(half).micros, half.micros);
});

test('invalid nutrition/portion values are rejected before persistence', () => {
  assert.throws(() => scanToMeal({ macros: { kcal: -5 } }));
  assert.throws(() => scaleMeal({}, NaN));
});

test('text and photo ingredient contracts normalize amounts and scale ingredient nutrition together', () => {
  const raw = [{ name: 'Rice', qty: '0,2 kg gekocht', kcal: 260, protein: 6, carbs: 56, fat: 1 }];
  const components = normalizeComponents(raw);
  assert.equal(components[0].amount_g, 200);
  assert.equal(sumYieldG(components), 200);
  assert.equal(amountToGrams('0,5 l'), 500);
  const meal = scanToMeal({ macros: { kcal: 260 }, components: raw });
  assert.deepEqual(meal.components, components);
  const half = scaleMeal(meal, 0.5).components[0];
  assert.equal(half.amount_g, 100);
  assert.equal(half.kcal, 130);
  assert.equal(half.carbs, 28);
  assert.equal(meal.components[0].kcal, 260);
  assert.deepEqual(normalizeComponents({ bad: true }), []);
});

test('catalog selection keeps its portion and provenance and rejects incomplete entries', () => {
  const item = { id: 'c1', name: 'Rice bowl', yield_g: 300, kcal: 400, protein: 20, carbs: 60, fat: 9, micros: { calcium_mg: 40 }, components: [{ name: 'Rice', amount_g: 200 }] };
  const meal = catalogToMeal(item);
  assert.equal(meal.id, undefined);
  assert.equal(meal.grams, 300);
  assert.equal(meal.source, 'catalog');
  assert.equal(mealDetails(meal).catalog_id, 'c1');
  assert.deepEqual(meal.micros, item.micros);
  assert.equal(scaleMeal(meal, 0.5).micros.calcium_mg, 20);
  assert.throws(() => catalogToMeal({ ...item, protein: null }), /vollständigen Makros/);
});
