import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
let uid = 'alice', catalogCalls = [], notesCalls = [], microsWrites = [], failLog = null, failNotes = null;
let storedCatalog = [{ id: 'a', name: 'Alt' }], storedMicros = [{ meal_name: 'A', v: 1 }];
mock.module('../src/client/lib/db/firestore/core.js', { namedExports: { getUid: () => uid } });
mock.module('../src/client/lib/cloudMutations.js', { namedExports: {
  mutateCloudLog: async () => { if (failLog) throw failLog; return { meals: [] }; },
  mutateCloudCatalog: async (kind, change) => { storedCatalog = change(storedCatalog); catalogCalls.push([kind, storedCatalog.map(i => i.id)]); return storedCatalog; },
} });
mock.module('../src/client/lib/db/firestore/notes.js', { namedExports: { saveNotes: async (date, content) => { if (failNotes) throw failNotes; notesCalls.push([date, content]); } } });
mock.module('../src/client/lib/db/firestore/nutrition.js', { namedExports: {
  getMicrosCatalog: async () => storedMicros, saveMicrosCatalog: async items => { storedMicros = items; microsWrites.push(items); },
} });
class Storage {
  getItem(key) { return this[key] ?? null; } setItem(key, value) { this[key] = value; } removeItem(key) { delete this[key]; }
  clear() { for (const key of Object.keys(this)) delete this[key]; }
}
globalThis.localStorage = new Storage();
globalThis.window = new EventTarget();
Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
const o = await import('../src/client/lib/cloudOutbox.js');

test('Katalog offline: gespeichert, sofort projiziert, nach Reconnect genau einmal geschrieben', async () => {
  const res = await o.submitCloudLog('catalog:nutrition', null, { op: 'upsert', matchName: true, item: { id: 'n1', name: 'Skyr' } });
  assert.equal(res.queued, true);
  assert.deepEqual(o.projectCloudCatalog('nutrition', [{ id: 'a', name: 'Alt' }]).map(i => i.id), ['a', 'n1']);
  assert.equal(o.hasPendingFor('catalog:nutrition'), true);
  navigator.onLine = true;
  await o.flushCloudOutbox();
  assert.deepEqual(catalogCalls, [['nutrition', ['a', 'n1']]]);
  assert.equal(o.outboxEntries(uid).length, 0);
  assert.equal(o.hasPendingFor('catalog:nutrition'), false);
});

test('Katalog online: sofort geschrieben, nichts bleibt in der Outbox', async () => {
  catalogCalls = []; localStorage.clear(); navigator.onLine = true;
  const res = await o.submitCloudLog('catalog:supplements', null, { op: 'delete', id: 'a' });
  assert.equal(res.ok, true); assert.notEqual(res.queued, true);
  assert.equal(catalogCalls.length, 1); assert.equal(o.outboxEntries(uid).length, 0);
});

test('Notizen: offline letzte Fassung gewinnt in der Anzeige, Replay schreibt in Reihenfolge', async () => {
  localStorage.clear(); notesCalls = []; navigator.onLine = false;
  await o.submitCloudLog('notes', '2026-10-16', { content: 'eins' });
  await o.submitCloudLog('notes', '2026-10-16', { content: 'zwei' });
  assert.equal(o.projectCloudNotes('2026-10-16', 'alt'), 'zwei');
  navigator.onLine = true; await o.flushCloudOutbox();
  assert.deepEqual(notesCalls, [['2026-10-16', 'eins'], ['2026-10-16', 'zwei']]);
});

test('Mikros: offline gequeued, beim Replay mit dem aktuellen Stand gemergt', async () => {
  localStorage.clear(); microsWrites = []; navigator.onLine = false;
  await o.submitCloudLog('micros', null, { items: [{ meal_name: 'B', v: 2 }] });
  storedMicros = [{ meal_name: 'A', v: 1 }, { meal_name: 'C', v: 9 }]; // zwischenzeitlich geändert
  navigator.onLine = true; await o.flushCloudOutbox();
  assert.deepEqual(microsWrites[0].map(i => i.meal_name), ['A', 'C', 'B']);
});

test('ein hängender Mahlzeit-Eintrag hält Katalog und Notizen NICHT auf', async () => {
  localStorage.clear(); catalogCalls = []; notesCalls = []; navigator.onLine = false;
  await o.submitCloudLog('nutrition', '2026-10-16', { meal: { id: 'm1' } });
  await o.submitCloudLog('catalog:nutrition', null, { op: 'upsert', item: { id: 'z', name: 'Z' } });
  await o.submitCloudLog('notes', '2026-10-16', { content: 'n' });
  navigator.onLine = true;
  failLog = Object.assign(new Error('Permission denied'), { code: 'permission-denied' });
  await assert.rejects(o.flushCloudOutbox());
  assert.equal(catalogCalls.length, 1); assert.equal(notesCalls.length, 1);          // andere Ströme liefen durch
  assert.deepEqual(o.outboxEntries(uid).map(e => e.kind), ['nutrition']);             // nur der Fehler bleibt (geblockt)
  assert.equal(o.outboxEntries(uid)[0].blocked, true);
  failLog = null; await o.flushCloudOutbox(); assert.equal(o.outboxEntries(uid).length, 0);
});

test('vorübergehender Fehler beim Schreiben: Eintrag bleibt, nicht geblockt, wird wiederholt', async () => {
  localStorage.clear(); notesCalls = []; navigator.onLine = true;
  failNotes = Object.assign(new Error('unavailable'), { code: 'unavailable' });
  const res = await o.submitCloudLog('notes', '2026-10-16', { content: 'x' });
  assert.equal(res.queued, true);
  assert.equal(o.outboxEntries(uid)[0].blocked, false);
  failNotes = null; await o.flushCloudOutbox();
  assert.deepEqual(notesCalls, [['2026-10-16', 'x']]);
});
