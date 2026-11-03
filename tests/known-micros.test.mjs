import test from 'node:test';
import assert from 'node:assert/strict';
import { knownMicros, scaleKnownMicros } from '../src/client/lib/knownMicros.js';

test('only supplied valid micronutrients survive; explicit zero stays known', () => {
  const raw = { calcium_mg: 0, iron_mg: 2, zinc_mg: null, vitamin_b12_ug: -1, omega3_epa_mg: 4, omega3_dha_mg: 6, unknown: 2 };
  assert.deepEqual(knownMicros(raw), { calcium_mg: 0, iron_mg: 2, omega3_epa_mg: 4, omega3_dha_mg: 6, omega3_epa_dha_mg: 10 });
  assert.deepEqual(scaleKnownMicros(raw, 0.5), { calcium_mg: 0, iron_mg: 1, omega3_epa_mg: 2, omega3_dha_mg: 3, omega3_epa_dha_mg: 5 });
  assert.deepEqual(knownMicros({ calcium_mg: '', iron_mg: ' ' }), {});
});
