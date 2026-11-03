import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
const records = new Map();
let writes = 0;
let pendingMeals = {};
let pendingSupplements = {};
const noop = () => {};
mock.module('firebase/firestore', { namedExports: {
  doc: (_db, ...parts) => parts.join('/'), collection: (_db, ...parts) => parts.join('/'), query: path => path,
  getDoc: async ref => ({ exists: () => records.has(ref), data: () => structuredClone(records.get(ref)) }),
  getDocs: async () => ({ forEach: noop }),
  setDoc: async () => { writes++; }, where: noop, orderBy: noop, limit: noop, documentId: noop, serverTimestamp: noop, deleteField: noop, writeBatch: noop,
} });
mock.module('../src/client/lib/firebase.js', { namedExports: { db: {} } });
mock.module('../src/client/lib/db/firestore/core.js', { namedExports: { getUid: () => 'alice' } });
mock.module('../src/client/lib/db/firestore/supplements.js', { namedExports: { getSupplementsCatalog: async () => [{ id: "mag", name: "Magnesium", micros: { magnesium_mg: 50 } }], getSupplementLog: async date => ({ date, intakes: pendingSupplements[date] || [] }) } });
mock.module('../src/client/lib/cloudOutbox.js', { namedExports: { projectCloudLog: (_kind,date,data) => ({ ...data, meals: [...(data.meals || []), ...(pendingMeals[date] || [])] }), projectCloudCatalog: (_kind, items) => items, projectCloudNotes: (_date, content) => content, hasPendingFor: () => false, outboxEntries: () => [] } });
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

test('weekly omega profiles distinguish an unknown split from known EPA+DHA', async () => {
  records.clear();
  const date = getWeekDates(2026, 42)[0];
  records.set('nutrition/alice/meta/catalog', { items: [] });
  records.set(`nutrition/alice/logs/${date}`, { date, meals: [
    { id: 'fish', description: 'Fish', micros: { omega3_epa_mg: 180, omega3_dha_mg: 120 } },
    { id: 'old', description: 'Old total', micros: { omega3_mg: 1200 } },
  ] });
  const result = await getWeeklyMicros(2026, 42);
  assert.equal(result.week_totals.omega3_epa_dha_mg, 300);
  assert.equal(result.rda_comparison.omega3_epa_dha_mg.coverage, 'partial');
  assert.equal(result.rda_comparison.omega3_epa_dha_mg.percent_of_dach, null);
  assert.equal(result.rda_comparison.omega3_ala_mg.avg_daily, null);
  assert.equal(result.meal_breakdown[date][1].micros.omega3_epa_mg, undefined);
});


test('weekly view includes locally queued meal and supplement contributions', async () => {
  records.clear(); pendingMeals = {}; pendingSupplements = {};
  const date = getWeekDates(2026, 42)[0];
  records.set('nutrition/alice/meta/catalog', { items: [] });
  pendingMeals[date] = [{ id: 'offline', description: 'Offline meal', micros: { magnesium_mg: 100 } }];
  pendingSupplements[date] = [{ id: 'supp-offline', supplement_id: 'mag' }];
  try {
    const week = await getWeeklyMicros(2026, 42);
    assert.equal(week.week_totals.magnesium_mg, 150);
    assert.deepEqual(week.meal_breakdown[date].map(entry => entry.id), ['offline', 'supp-offline']);
  } finally { pendingMeals = {}; pendingSupplements = {}; }
});
