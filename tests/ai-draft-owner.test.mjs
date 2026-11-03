import test from 'node:test';
import assert from 'node:assert/strict';
import { createDraftOwnerGuard } from '../src/client/lib/aiDraftOwner.js';

test('a delayed draft attempt cannot continue after logout or account change', () => {
  let current = 'alice';
  const guard = createDraftOwnerGuard(() => current);
  assert.doesNotThrow(guard);
  current = 'bob';
  assert.throws(guard, /Konto hat gewechselt/);
  current = null;
  assert.throws(guard, /Konto hat gewechselt/);
  assert.throws(() => createDraftOwnerGuard(() => current), /anmelden/);
});
