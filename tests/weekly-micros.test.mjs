import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
const records = new Map();
let writes = 0;
const noop = () => {};
mock.module('firebase/firestore', { namedExports: {
  doc: (_db, ...parts) => parts.join('/'), collection: (_db, ...parts) => parts.join('/'), query: path => path,
  getDoc: async ref => ({ exists: () => records.has(ref), data: () => structuredClone(records.get(ref)) }),
  getDocs: async () => ({ forEach: noop }),
  setDoc: async () => { writes++; }, where: noop, orderBy: noop, limit: noop, documentId: noop, serverTimestamp: noop, deleteField: noop, writeBatch: noop,
} });
mock.module('../src/client/lib/firebase.js', { namedExports: { db: {} } });
mock.module('../src/client/lib/db/firestore/core.js', { namedExports: { getUid: () => 'alice' } });
mock.module('../src/client/lib/db/firestore/supplements.js', { namedExports: { getSupplementsCatalog: async () => [] } });
mock.module('../src/client/lib/cloudOutbox.js', { namedExports: { projectCloudLog: (_kind,_date,data) => data, projectCloudCatalog: (_kind, items) => items, projectCloudNotes: (_date, content) => content, hasPendingFor: () => false, outboxEntries: () => [] } });
mock.module('../src/client/lib/cloudMutations.js', { namedExports: { mutateCloudLog: noop } });
const { getWeeklyMicros } = await import('../src/client/lib/db/firestore/nutrition.js');
const { getWeekDates } = await import('../src/client/lib/db/firestore/utils.js');

test('weekly reads keep meal provenance, ignore stale caches and never rewrite logs', async () => {
  const date = getWeekDates(2026, 42)[0];
  records.set(`nutrition/alice/logs/${date}`, { date, meals: [{ id: 'a', description: 'Rice', kcal: 200 }], micro_totals: { calcium_mg: 999 }, micro_totals_complete: true });
  records.set('nutrition/alice/meta/catalog', { items: [{ id: 'rice', name: 'Rice', kcal: 200, micros: { calcium_mg: 100 } }] });
  const first = await getWeeklyMicros(2026, 42);
  assert.equal(first.week_totals.calcium_mg, 100);
  assert.equal(first.meal_breakdown[date][0].micros_meta.origin, 'catalog_embedded');
  records.get('nutrition/alice/meta/catalog').items[0].micros.calcium_mg = 200;
  const second = await getWeeklyMicros(2026, 42);
  assert.equal(second.week_totals.calcium_mg, 200);
  assert.equal(second.meal_breakdown[date][0].micros.calcium_mg, 200);
  assert.equal(writes, 0);
  assert.equal(records.get(`nutrition/alice/logs/${date}`).meals[0].micros, undefined);
});
