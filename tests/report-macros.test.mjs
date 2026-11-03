import test from 'node:test';
import assert from 'node:assert/strict';
import { sumMeals, macroSplit, averageMealsByDay, displayMacro } from '../src/client/views/Report/reportMacros.mjs';

test('missing macros do not masquerade as zero or complete totals', () => {
  const meal = { kcal: 100, protein: 0, carbs: 20, fat: 1 };
  const missing = { kcal: 50, protein: '', carbs: 10, fat: null };
  assert.deepEqual(sumMeals([meal, missing]), { kcal: 150, protein: null, carbs: 30, fat: null });
  assert.equal(macroSplit(sumMeals([meal, missing])), null);
  assert.equal(displayMacro(0), '0');
  assert.equal(displayMacro(''), '—');
  assert.equal(displayMacro(null), '—');
  assert.deepEqual(averageMealsByDay([[meal], [missing]]), { kcal: 75, protein: null, carbs: 15, fat: null });
  assert.equal(macroSplit({ protein: 0, carbs: 0, fat: 0 }), null);
  assert.equal(averageMealsByDay([]).kcal, null);
});
