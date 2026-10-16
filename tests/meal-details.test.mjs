import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mealDetails, scanToMeal, scaleMeal } from '../src/client/lib/mealDetails.js';

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
