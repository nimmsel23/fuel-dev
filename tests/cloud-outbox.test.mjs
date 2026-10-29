import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
let uid = 'alice', executed = [], failure;
mock.module('../src/client/lib/db/firestore/core.js', { namedExports: { getUid: () => uid } });
mock.module('../src/client/lib/db/firestore/notes.js', { namedExports: { saveNotes: async () => {} } });
mock.module('../src/client/lib/db/firestore/nutrition.js', { namedExports: { getMicrosCatalog: async () => [], saveMicrosCatalog: async () => {} } });
mock.module('../src/client/lib/cloudMutations.js', { namedExports: { mutateCloudCatalog: async () => ({}), mutateCloudLog: async (...args) => {
  if (failure) throw failure;
  executed.push([uid, ...args]); return { meals: [] };
} } });
class Storage {
  getItem(key) { return this[key] ?? null; }
  setItem(key, value) { this[key] = value; }
  removeItem(key) { delete this[key]; }
  clear() { for (const key of Object.keys(this)) delete this[key]; }
}
globalThis.localStorage = new Storage();
globalThis.window = new EventTarget();
Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
const { submitCloudLog, flushCloudOutbox, outboxEntries, projectCloudLog } = await import('../src/client/lib/cloudOutbox.js');

test('offline commands survive module reload and replay only for their owner', async () => {
  assert.equal((await submitCloudLog('nutrition', '2026-10-16', { meal: { id: 'a' } })).queued, true);
  assert.deepEqual(projectCloudLog('nutrition', '2026-10-16', { meals: [] }).meals, [{ id: 'a' }]);
  const reloaded = await import('../src/client/lib/cloudOutbox.js?reload');
  uid = 'bob'; navigator.onLine = true;
  await reloaded.flushCloudOutbox(); assert.equal(executed.length, 0);
  uid = 'alice'; await reloaded.flushCloudOutbox();
  assert.equal(executed.length, 1); assert.equal(outboxEntries(uid).length, 0);
});

test('permission failure stays visible and blocks later work', async () => {
  localStorage.clear(); executed = [];
  failure = Object.assign(new Error('Permission denied'), { code: 'permission-denied' });
  await assert.rejects(submitCloudLog('nutrition', '2026-10-16', { meal: { id: 'b' } }));
  assert.equal(outboxEntries(uid)[0].blocked, true);
  assert.equal((await submitCloudLog('nutrition', '2026-10-16', { meal: { id: 'c' } })).queued, true);
  await assert.rejects(flushCloudOutbox()); assert.equal(executed.length, 0);
  failure = null; await flushCloudOutbox(); assert.equal(outboxEntries(uid).length, 0);
});

test('full storage never reports a successful offline save', async () => {
  const original = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('Storage full'); };
  navigator.onLine = false;
  await assert.rejects(submitCloudLog('nutrition', '2026-10-16', { meal: { id: 'd' } }), /Storage full/);
  localStorage.setItem = original;
});


test('React Query executes durable writes and cached reads while offline', async () => {
  const { onlineManager } = await import('@tanstack/react-query');
  const { createFuelQueryClient } = await import('../src/client/lib/queryClient.js');
  localStorage.clear(); navigator.onLine = false; onlineManager.setOnline(false);
  const client = createFuelQueryClient();
  const defaults = client.getDefaultOptions();
  client.setDefaultOptions({ queries: { ...defaults.queries, gcTime: Infinity }, mutations: { ...defaults.mutations, gcTime: Infinity } });
  try {
    const mutation = client.getMutationCache().build(client, { mutationFn: () => submitCloudLog('nutrition', '2026-10-16', { meal: { id: 'offline-ui' } }) });
    assert.equal((await mutation.execute()).queued, true);
    assert.equal(outboxEntries(uid).length, 1);
    assert.equal(await client.fetchQuery({ queryKey: ['offline-cache'], queryFn: async () => 'cached' }), 'cached');
  } finally { client.clear(); onlineManager.setOnline(true); }
});

test('background supplement saves acknowledge local durability before cloud completion', async () => {
  localStorage.clear(); executed = []; failure = null; navigator.onLine = true;
  let release;
  const held = new Promise(resolve => { release = resolve; });
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (_key, work) => { await held; return work(); } } });
  const result = await submitCloudLog('supplements', '2026-10-16', { intake: { id: 'fast', supplement_id: 'one' } }, { background: true });
  assert.equal(result.queued, true);
  assert.equal(executed.length, 0);
  assert.equal(outboxEntries(uid).length, 1);
  assert.equal(projectCloudLog('supplements', '2026-10-16', { intakes: [] }).intakes[0].id, 'fast');
  release();
  await flushCloudOutbox();
  assert.equal(outboxEntries(uid).length, 0);
  delete navigator.locks;
});

test('a rejected background write remains visible and is excluded from projected success', async () => {
  localStorage.clear(); navigator.onLine = true;
  failure = Object.assign(new Error('Permission denied'), { code: 'permission-denied' });
  const result = await submitCloudLog('supplements', '2026-10-16', { intake: { id: 'rejected', supplement_id: 'one' } }, { background: true });
  assert.equal(result.queued, true);
  await assert.rejects(flushCloudOutbox(), /Permission denied/);
  assert.equal(outboxEntries(uid)[0].blocked, true);
  assert.deepEqual(projectCloudLog('supplements', '2026-10-16', { intakes: [] }).intakes, []);
  failure = null; localStorage.clear();
});
