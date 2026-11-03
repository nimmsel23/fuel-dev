import test from 'node:test';
import assert from 'node:assert/strict';
import { findCatalogMatch } from '../src/client/lib/mealCatalogMatch.js';

const rice = { id: 'rice', name: 'Reis', kcal: 130, protein: 3, carbs: 28, fat: 0 };
test('automatic catalog reuse requires a unique complete exact dish', () => {
  assert.equal(findCatalogMatch([rice], '  REIS  '), rice);
  assert.equal(findCatalogMatch([rice], 'Reis mit Gemüse'), null);
  assert.equal(findCatalogMatch([{ ...rice, name: 'Reis mit Gemüse' }], 'Reis'), null);
  assert.equal(findCatalogMatch([rice, { ...rice, id: 'other' }], 'Reis'), null);
  assert.equal(findCatalogMatch([{ ...rice, protein: null }], 'Reis'), null);
  assert.equal(findCatalogMatch([{ ...rice, protein: '' }], 'Reis'), null);
  assert.equal(findCatalogMatch([{ ...rice, fat: -1 }], 'Reis'), null);
});
