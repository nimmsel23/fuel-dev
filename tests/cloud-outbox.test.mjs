import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
let uid = 'alice', executed = [], failure;
mock.module('../src/client/lib/db/firestore/core.js', { namedExports: { getUid: () => uid } });
mock.module('../src/client/lib/cloudMutations.js', { namedExports: { mutateCloudLog: async (...args) => {
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
