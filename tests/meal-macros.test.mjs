import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMealMacros, mealMacrosAreValid } from '../src/client/lib/mealMacros.js';
import { catalogFromLoggedMeal } from '../src/client/lib/loggedMealCatalog.js';

test('manual values retain unknowns, numeric zero and numeric types through catalog creation', () => {
  const input = { kcal: '100', protein: '', carbs: '0', fat: null };
  assert.deepEqual(normalizeMealMacros(input), { kcal: 100, protein: null, carbs: 0, fat: null });
  const [item] = catalogFromLoggedMeal([], { ...input, id: 'meal', description: 'Example', time: '2026-01-01' });
  assert.equal(item.protein, null); assert.equal(item.carbs, 0); assert.equal(item.kcal, 100);
  assert.equal(mealMacrosAreValid({ ...input, protein: '-1' }), false);
  assert.equal(mealMacrosAreValid({ ...input, protein: 'abc' }), false);
});

test('daily macro coverage distinguishes unknown values from known zero', async () => {
  const { missingMealMacros } = await import('../src/client/lib/mealMacros.js');
  assert.deepEqual(missingMealMacros([{ kcal: 0, protein: null, carbs: '', fat: 2 }, { kcal: '200', protein: 3, carbs: 4, fat: undefined }]), { kcal: 0, protein: 1, carbs: 1, fat: 1 });
  assert.deepEqual(missingMealMacros([]), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
});
