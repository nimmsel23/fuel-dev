import test from "node:test";
import assert from "node:assert/strict";
import { AI_ENABLED, assertLegacyAiAvailable } from "../src/client/lib/aiAvailability.js";
import { STORE_BUILD, isCloudRuntime } from "../src/client/lib/cloudEnv.js";

test("owner/dev build (no edition flags) keeps AI and local routing", () => {
  assert.equal(STORE_BUILD, false);
  assert.equal(AI_ENABLED, true);
  assert.doesNotThrow(() => assertLegacyAiAvailable());
  assert.equal(isCloudRuntime(), false);
});

test("store build guard blocks every AI call path", () => {
  assert.throws(() => assertLegacyAiAvailable(true), /nicht verfügbar/);
});
