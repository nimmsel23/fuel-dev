import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { validateBackup, mergeBackupDocument } from '../src/client/lib/backupFormat.js';
let uid = 'alice', failAt, retryHook;
const documents = new Map();
const snap = ref => ({ id: ref.split('/').at(-1), exists: () => documents.has(ref), data: () => structuredClone(documents.get(ref)) });
mock.module('firebase/firestore', { namedExports: {
  doc: (_db, ...parts) => parts.join('/'), collection: (_db, ...parts) => parts.join('/'),
  getDocFromServer: async ref => snap(ref), getDocsFromServer: async path => ({ docs: [...documents.keys()].filter(k => k.startsWith(path + '/') && k.split('/').length === path.split('/').length + 1).map(snap) }),
  serverTimestamp: () => 'now', deleteField: () => null, waitForPendingWrites: async () => {},
  runTransaction: async (_db, callback) => {
    for (;;) {
      const writes = [];
      const value = await callback({ get: async ref => { if (ref === failAt) throw new Error('Denied'); return snap(ref); }, set: (ref, value) => writes.push([ref, value]) });
      if (retryHook) { const hook = retryHook; retryHook = null; hook(); continue; }
      for (const [ref, value] of writes) documents.set(ref, value);
      return value;
    }
  },
} });
mock.module('../src/client/lib/firebase.js', { namedExports: { db: {} } });
mock.module('../src/client/lib/db/firestore/core.js', { namedExports: { getUid: () => uid } });
mock.module('../src/client/lib/cloudOutbox.js', { namedExports: { outboxEntries: () => [] } });
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
const { exportCloudBackup, previewCloudRestore, restoreCloudBackup } = await import('../src/client/lib/cloudBackup.js');
const backup = docs => ({ format: 'fuel-backup', version: 1, uid: 'alice', exportedAt: '2026-10-16T12:00:00.000Z', documents: docs });
const day = (date, meals) => ({ kind: 'nutrition-log', id: date, data: { date, meals } });

test('validation rejects other accounts, paths, future formats and malformed entries', () => {
  assert.throws(() => validateBackup({ ...backup([]), uid: 'bob' }, 'alice'), /anderen Konto/);
  assert.throws(() => validateBackup({ ...backup([]), version: 2 }, 'alice'));
  assert.throws(() => validateBackup(backup([{ kind: 'nutrition-log', id: '../settings', data: {} }]), 'alice'));
  const duplicate = day('2026-10-16', [{ id: 'a', description: 'A' }]);
  assert.throws(() => validateBackup(backup([duplicate, duplicate]), 'alice'), /doppelte/);
  assert.throws(() => validateBackup(backup([day('2026-02-30', [])]), 'alice'));
  assert.throws(() => validateBackup(backup([day('2026-10-16', [{ id: 'a', description: 'A', kcal: -1 }])]), 'alice'));
  assert.throws(() => validateBackup(backup([{ kind: 'settings', id: 'settings', data: { hydrateFromCloud: 'broken' } }]), 'alice'));
});

test('merge is additive, idempotent and respects current deletion marks', () => {
  const current = { meals: [{ id: 'a', description: 'Current' }], water_ml: 1000, deleted_meal_ids: ['deleted'] };
  const incoming = { meals: [{ id: 'a', description: 'Old' }, { id: 'new', description: 'New' }, { id: 'deleted', description: 'Deleted' }], water_ml: 500 };
  const merged = mergeBackupDocument('nutrition-log', current, incoming);
  assert.equal(merged.addedEntries, 1); assert.equal(merged.data.water_ml, 1000);
  assert.equal(merged.data.meals[0].description, 'Current');
  assert.deepEqual(merged.data.meals.map(m => m.id), ['a', 'new']);
  assert.equal(mergeBackupDocument('nutrition-log', merged.data, incoming).changed, false);
});

test('export is restricted to user data and a real roundtrip restores missing records', async () => {
  documents.clear();
  documents.set('nutrition/alice/logs/2026-10-16', { date: '2026-10-16', meals: [{ id: 'a', description: 'Lunch', grams: 100, micros: { calcium_mg: 20 } }], updated_at: 'old', micro_totals: { calcium_mg: 20 } });
  documents.set('nutrition/public/meta/micros', { items: ['public'] });
  documents.set('users/alice/fcm/token', { token: 'excluded' });
  documents.set('users/alice/meta/settings', { water_goal: 2500 });
  const exported = JSON.parse(JSON.stringify(await exportCloudBackup()));
  assert.equal(exported.documents.length, 2);
  assert.equal(exported.documents[0].data.micro_totals, undefined);
  documents.delete('nutrition/alice/logs/2026-10-16');
  const preview = await previewCloudRestore(exported);
  assert.equal(preview.addedDocuments, 1); assert.equal(preview.addedEntries, 1);
  await restoreCloudBackup(exported);
  assert.equal(documents.get('nutrition/alice/logs/2026-10-16').meals[0].micros.calcium_mg, 20);
  assert.equal((await restoreCloudBackup(exported)).changed, 0);
});

test('concurrent changes win when restore transaction retries', async () => {
  documents.clear();
  const path = 'nutrition/alice/logs/2026-10-16';
  retryHook = () => documents.set(path, { meals: [{ id: 'a', description: 'Concurrent' }], water_ml: 1500 });
  await restoreCloudBackup(backup([day('2026-10-16', [{ id: 'a', description: 'Backup' }, { id: 'b', description: 'Missing' }])]));
  assert.equal(documents.get(path).meals[0].description, 'Concurrent');
  assert.equal(documents.get(path).water_ml, 1500);
  assert.equal(documents.get(path).meals.length, 2);
});

test('partial failure reports progress and repeated restore completes without duplicates', async () => {
  documents.clear();
  const input = backup([day('2026-10-16', [{ id: 'a', description: 'A' }]), day('2026-10-17', [{ id: 'b', description: 'B' }])]);
  failAt = 'nutrition/alice/logs/2026-10-17';
  await assert.rejects(restoreCloudBackup(input), /1\/2.*unterbrochen/);
  assert.equal(documents.size, 1);
  failAt = null; await restoreCloudBackup(input);
  assert.equal(documents.size, 2); assert.equal(documents.get('nutrition/alice/logs/2026-10-16').meals.length, 1);
  uid = 'bob'; await assert.rejects(restoreCloudBackup(input), /anderen Konto/); uid = 'alice';
});
