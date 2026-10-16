import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withStorageFeedback, STORAGE_FEEDBACK_EVENT } from '../src/client/lib/storageFeedback.js';

test('direct SDK write failures remain observable even when a caller catches them', async () => {
  globalThis.window = new EventTarget();
  const messages = [];
  window.addEventListener(STORAGE_FEEDBACK_EVENT, e => messages.push(e.detail));
  const failure = new Error('Permission denied');
  await assert.rejects(withStorageFeedback('Settings', async () => { throw failure; }), failure);
  assert.deepEqual(messages[0], { label: 'Settings', error: 'Permission denied' });
  assert.equal(await withStorageFeedback('Settings', async () => 42), 42);
  assert.deepEqual(messages[1], { label: 'Settings', error: null });
});
