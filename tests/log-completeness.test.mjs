import test from 'node:test';
import assert from 'node:assert/strict';
import { requireCompleteLog } from '../src/client/lib/logCompleteness.js';

test('a projected outbox without a cached base cannot be treated as a complete day', () => {
  const incomplete = { meals: [{ id: 'queued' }], local_base_unavailable: true };
  assert.throws(() => requireCompleteLog(incomplete), /Tagesstand.*offline/);
  const complete = { meals: [{ id: 'existing' }, { id: 'queued' }] };
  assert.equal(requireCompleteLog(complete), complete);
});
