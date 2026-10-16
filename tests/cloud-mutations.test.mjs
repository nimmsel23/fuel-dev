import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { changeLog } from '../src/client/lib/cloudLogState.js';

const documents = new Map();
let attempt = 0;
let retry;
mock.module('firebase/firestore', { namedExports: {
  doc: (_db, ...parts) => parts.join('/'),
  serverTimestamp: () => 'now', deleteField: () => null,
  runTransaction: async (_db, callback) => {
    for (;;) {
      const writes = [];
      const result = await callback({
        get: async ref => ({ exists: () => documents.has(ref), data: () => structuredClone(documents.get(ref)) }),
        set: (ref, data) => writes.push([ref, structuredClone(data)]),
      });
      if (attempt++ === 0 && retry) { retry(); continue; }
      for (const [ref, value] of writes) documents.set(ref, { ...documents.get(ref), ...value });
      return result;
    }
  },
} });
mock.module('../src/client/lib/firebase.js', { namedExports: { db: {} } });
mock.module('../src/client/lib/db/firestore/core.js', { namedExports: { getUid: () => 'alice' } });
const { mutateCloudLog } = await import('../src/client/lib/cloudMutations.js');

test('transaction retries preserve concurrent additions and water increments', async () => {
  documents.clear(); attempt = 0;
  const ref = 'nutrition/alice/logs/2026-10-16';
  documents.set(ref, { meals: [{ id: 'old' }], water_ml: 250 });
  retry = () => documents.set(ref, { meals: [{ id: 'old' }, { id: 'other-device' }], water_ml: 500 });
  await mutateCloudLog('nutrition', '2026-10-16', { meal: { id: 'new' }, water_delta: 250 });
  assert.deepEqual(documents.get(ref).meals.map(m => m.id), ['old', 'other-device', 'new']);
  assert.equal(documents.get(ref).water_ml, 750);
});

test('move retries both days together and leaves a source tombstone', async () => {
  documents.clear(); attempt = 0;
  const source = 'nutrition/alice/logs/2026-10-16', target = 'nutrition/alice/logs/2026-10-17';
  documents.set(source, { meals: [{ id: 'move', description: 'Lunch' }] });
  retry = () => documents.set(target, { meals: [{ id: 'other' }] });
  await mutateCloudLog('nutrition', '2026-10-16', { meal_id: 'move', meal: { description: 'Edited' }, new_date: '2026-10-17', move_id: 'moved' });
  assert.deepEqual(documents.get(source).meals, []);
  assert.deepEqual(documents.get(source).deleted_meal_ids, ['move']);
  assert.deepEqual(documents.get(target).meals, [{ id: 'other' }, { id: 'moved', description: 'Edited' }]);
});

test('missing source aborts move without target changes', async () => {
  documents.clear(); retry = null;
  await assert.rejects(mutateCloudLog('nutrition', '2026-10-16', { meal_id: 'missing', new_date: '2026-10-17', move_id: 'moved' }));
  assert.equal(documents.size, 0);
});

test('replayed additions are idempotent and deletion blocks resurrection', () => {
  const added = changeLog('nutrition', { meals: [] }, { meal: { id: 'one' } });
  assert.equal(changeLog('nutrition', added, { meal: { id: 'one' } }).meals.length, 1);
  const deleted = changeLog('nutrition', added, { delete_meal_id: 'one' });
  assert.equal(changeLog('nutrition', deleted, { meal: { id: 'one' } }).meals.length, 0);
});

test('receipt prevents a replayed water increment after lost acknowledgement', async () => {
  documents.clear(); retry = null;
  const command = { water_delta: 250, operation_id: 'same-command' };
  await mutateCloudLog('nutrition', '2026-10-16', command);
  await mutateCloudLog('nutrition', '2026-10-16', command);
  assert.equal(documents.get('nutrition/alice/logs/2026-10-16').water_ml, 250);
});

test('offline replay adds the catalog profile in the same transaction exactly once', async () => {
  documents.clear(); retry = null;
  const command = { operation_id: 'log-with-catalog', meal: { id: 'scan', description: 'Scanned lunch', logged_at: '2026-10-16T12:00:00Z', grams: 200, micros: { calcium_mg: 20 }, micros_meta: { source: 'gemini' } } };
  await mutateCloudLog('nutrition', '2026-10-16', command);
  await mutateCloudLog('nutrition', '2026-10-16', command);
  const catalog = documents.get('nutrition/alice/meta/catalog').items;
  assert.equal(catalog.length, 1); assert.equal(catalog[0].use_count, 1);
  assert.equal(catalog[0].yield_g, 200); assert.equal(catalog[0].micros.calcium_mg, 20);
});
