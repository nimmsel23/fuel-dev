import test from 'node:test';
import assert from 'node:assert/strict';
import { nutrientCoverage } from '../src/shared/config/nutrient-coverage.mjs';

test('coverage distinguishes explicit zeros, missing values and incomplete sums', () => {
  const baseline = { iron_mg: { avg_daily: 2, total_week: 14, percent_of_dach: 20, status: 'low' }, calcium_mg: { avg_daily: 0, total_week: 0, percent_of_dach: 0 } };
  const partial = nutrientCoverage({ mon: [{ micros: { iron_mg: 2, calcium_mg: 0 } }, { micros: { calcium_mg: 0 } }] }, baseline);
  assert.equal(partial.iron_mg.coverage, 'partial');
  assert.equal(partial.iron_mg.percent_of_dach, null);
  assert.equal(partial.iron_mg.avg_daily, 2);
  assert.equal(partial.calcium_mg.coverage, 'complete');
  assert.equal(partial.calcium_mg.percent_of_dach, 0);
  const empty = nutrientCoverage({}, baseline);
  assert.equal(empty.iron_mg.coverage, 'unknown');
  assert.equal(empty.iron_mg.avg_daily, null);
  assert.equal(empty.iron_mg.percent_of_dach, null);
});
