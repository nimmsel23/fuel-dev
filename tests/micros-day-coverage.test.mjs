import test from 'node:test';
import assert from 'node:assert/strict';
import { dayNutrientSummary } from '../src/client/views/Micros/dayCoverage.js';

test('daily detail preserves missing and zero entries and marks partial sums', () => {
  const result = dayNutrientSummary([{ micros: { iron_mg: 2 } }, { micros: {} }, { micros: { iron_mg: 0 } }], 'iron_mg');
  assert.equal(result.coverage, 'partial');
  assert.equal(result.value, 2);
  assert.deepEqual(result.contributions.map(e => e.value), [2, null, 0]);
  assert.equal(dayNutrientSummary([{ micros: {} }], 'iron_mg').value, null);
  assert.equal(dayNutrientSummary([{ micros: { iron_mg: 0 } }], 'iron_mg').coverage, 'complete');
  assert.equal(dayNutrientSummary([], 'iron_mg').coverage, 'unknown');
});
