import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScanQueue } from '../src/client/lib/scanQueue.js';

// Persistent store boundary shared across fresh queue instances (reload).
const entries = new Map();
let owner = 'alice';
const store = {
  getAll: async () => [...entries.values()],
  get: async id => entries.get(id),
  put: async entry => entries.set(entry.id, structuredClone(entry)),
  delete: async id => entries.delete(id),
};
const db = { getAll: store.getAll, transaction: () => ({ store, done: Promise.resolve(), abort() {} }) };
const open = async () => db;
const queue = createScanQueue(() => owner, open);
const file = new File(['photo'], 'meal.jpg', { type: 'image/jpeg' });

test('queued photos survive reload with original day/type and are isolated by authenticated owner', async () => {
  const entry = await queue.add('alice', file, '2026-10-29', 'label');
  const reloaded = createScanQueue(() => owner, open);
  const saved = await reloaded.list('alice');
  assert.equal(saved[0].date, '2026-10-29');
  assert.equal(saved[0].scanType, 'label');
  assert.equal(await saved[0].file.text(), 'photo');
  owner = 'bob';
  assert.deepEqual(await reloaded.list('bob'), []);
  await assert.rejects(reloaded.list('alice'), /demselben Konto/);
  await reloaded.remove('bob', entry.id);
  assert.equal(entries.size, 1);
  owner = null;
  await assert.rejects(queue.add(null, file, '2026-10-29', 'food'), /anmelden/);
  owner = 'alice';
  await queue.remove('alice', entry.id);
  assert.equal(entries.size, 0);
});

test('queue rejects invalid files, full queues and unavailable storage without claiming success', async () => {
  await assert.rejects(queue.add('alice', new File(['x'], 'x.txt', { type: 'text/plain' }), '2026-10-30', 'food'), /Bild/);
  await assert.rejects(queue.add('alice', { type: 'image/jpeg', size: 9 * 1024 * 1024 }, '2026-10-30', 'food'), /8 MB/);
  await assert.rejects(queue.add('alice', file, undefined, 'food'), /Foto-Tag/);
  const unavailable = createScanQueue(() => owner, async () => { throw new Error('QuotaExceededError'); });
  await assert.rejects(unavailable.add('alice', file, '2026-10-30', 'food'), /QuotaExceeded/);
  for (let i = 0; i < 12; i++) await queue.add('alice', file, '2026-10-30', 'food');
  await assert.rejects(queue.add('alice', file, '2026-10-30', 'food'), /voll/);
  assert.equal((await queue.list('alice')).length, 12);
  entries.clear();
});

test('account switch while opening IndexedDB never exposes or changes the previous account drafts', async () => {
  const switching = createScanQueue(() => owner, async () => { owner = 'bob'; return db; });
  owner = 'alice';
  await assert.rejects(switching.add('alice', file, '2026-10-30', 'food'), /demselben Konto/);
  assert.equal(entries.size, 0);
  owner = 'alice';
});
