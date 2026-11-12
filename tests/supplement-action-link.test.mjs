import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decideAuthTokenReply } from "../src/client/lib/swAuthReply.js";
import {
  buildSupplementActionHash,
  parseSupplementActionHash,
  rememberSupplementAction,
  readPendingSupplementAction,
  clearSupplementActionLink,
  planQuickYes,
  planSnooze,
  intakeIdFor,
  startPendingSupplementAction,
  mergeLoggedIntakes,
} from "../src/client/lib/supplementActionLink.js";

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
  };
}

async function withWindow(hash, fn) {
  const previousWindow = globalThis.window;
  const previousStorage = globalThis.sessionStorage;
  const storage = memoryStorage();
  const location = {
    href: `https://fuel-vos.web.app/${hash}`,
    pathname: "/",
    search: "",
    hash,
  };
  globalThis.sessionStorage = storage;
  globalThis.window = {
    location,
    history: {
      replaceState(_state, _title, next) {
        location.href = `https://fuel-vos.web.app${next}`;
        location.hash = next.includes("#") ? next.slice(next.indexOf("#")) : "";
      },
    },
  };
  try {
    return await fn(storage, location);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousStorage === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = previousStorage;
  }
}

test("Hash trägt Aktion, Supplement und Datum und lässt sich zurücklesen", () => {
  const hash = buildSupplementActionHash("quick-yes", "2026-11-12", ["mag", "zinc/a"]);
  assert.equal(hash, "#supplements/2026-11-12/quick-yes/mag,zinc%2Fa");
  assert.deepEqual(parseSupplementActionHash(hash), {
    action: "quick-yes",
    date: "2026-11-12",
    supplementIds: ["mag", "zinc/a"],
    key: "quick-yes:2026-11-12:mag,zinc/a",
  });
  assert.equal(parseSupplementActionHash("#supplements/2026-11-12"), null);
  assert.equal(parseSupplementActionHash("#supplements/heute/snooze/mag"), null);
});

test("dieselbe Aktion wird nur einmal gemerkt, einmal ausgeführt und der Hash danach entfernt", async () => {
  await withWindow("#supplements/2026-11-12/snooze/mag,mag", (storage, location) => {
    const first = rememberSupplementAction(parseSupplementActionHash(location.hash));
    const second = rememberSupplementAction(parseSupplementActionHash(location.hash));
    assert.equal(first.key, second.key);
    assert.deepEqual(readPendingSupplementAction().supplementIds, ["mag"]);
    clearSupplementActionLink();
    assert.equal(readPendingSupplementAction(), null);
    assert.equal(storage.getItem("fuel-supplement-action"), null);
    assert.equal(location.hash, "#supplements/2026-11-12");
  });

  await withWindow("#supplements/2026-11-12/quick-yes/mag", async () => {
    rememberSupplementAction(parseSupplementActionHash(window.location.hash));
    let calls = 0;
    const first = startPendingSupplementAction(async () => {
      calls += 1;
      return false;
    });
    const second = startPendingSupplementAction(async () => {
      calls += 1;
      return true;
    });
    assert.equal(await first, false);
    assert.equal(second, first);
    assert.equal(calls, 1);
    assert.equal(readPendingSupplementAction().action, "quick-yes");

    assert.equal(await startPendingSupplementAction(async () => true), true);
    assert.equal(readPendingSupplementAction(), null);
    assert.equal(window.location.hash, "#supplements/2026-11-12");
  });
});

test("Quick-yes plant keine zweite Einnahme für ein schon geloggtes Supplement", () => {
  const catalog = [{ id: "mag", name: "Magnesium", default_dose: 400, unit: "mg", default_time_of_day: "morning" }];
  const first = planQuickYes(["mag", "zinc", "mag"], [], catalog, "2026-11-12");
  assert.deepEqual(first.map((item) => item.supplement_id), ["mag", "zinc"]);
  assert.equal(first[0].id, intakeIdFor("2026-11-12", "mag"));
  assert.equal(first[0].name, "Magnesium");
  const again = planQuickYes(["mag", "zinc"], [
    { id: "other", supplement_id: "mag" },
    { id: intakeIdFor("2026-11-12", "zinc"), supplement_id: "zinc" },
  ], catalog, "2026-11-12");
  assert.deepEqual(again, []);
});

test("Snooze verlängert eine noch laufende Pause nicht", () => {
  const now = 1_000_000;
  const updates = planSnooze(["mag", "zinc", "mag"], { mag: now + 60_000 }, now);
  assert.deepEqual(updates, { zinc: now + 30 * 60 * 1000 });
  assert.deepEqual(planSnooze(["zinc"], { zinc: now + 1 }, now), {});
});

test("eine noch nicht wiederhergestellte Session gilt nicht als Logout", () => {
  assert.deepEqual(decideAuthTokenReply({ restored: false, signedIn: false, token: null }), { kind: "wait" });
  assert.deepEqual(decideAuthTokenReply({ restored: true, signedIn: false, token: null }), { kind: "logout" });
  assert.deepEqual(decideAuthTokenReply({ restored: true, signedIn: true, token: null }), { kind: "keep" });
  assert.deepEqual(decideAuthTokenReply({ restored: true, signedIn: true, token: "id-token" }), { kind: "token", token: "id-token" });
});

test("ein Replay-Intake verdrängt keinen zweiten Tipp auf dasselbe Supplement", () => {
  const merged = mergeLoggedIntakes(
    { date: "2026-11-12", intakes: [{ id: "old", supplement_id: "zinc" }] },
    [{ id: "action_2026-11-12_mag", supplement_id: "mag", name: "Magnesium" }, { id: "other", supplement_id: "zinc" }],
  );
  assert.deepEqual(merged.intakes.map((item) => item.supplement_id), ["zinc", "mag"]);
  const again = mergeLoggedIntakes(merged, [{ id: "fresh", supplement_id: "mag" }]);
  assert.equal(again.intakes.filter((item) => item.supplement_id === "mag").length, 1);
});

test("der Service Worker öffnet bei fehlendem Token und bei 401 den Aktions-Hash", () => {
  const source = readFileSync(new URL("../scripts/fuel-sw-extra.js", import.meta.url), "utf8");
  assert.match(source, /url\.hash = `supplements\/\$\{dateStr\}\/\$\{action\}\/\$\{ids\}`/);
  assert.match(source, /clients\.openWindow\(url\)/);
  assert.match(source, /client\.focus\(\)/);
  assert.match(source, /status === 401/);
  assert.match(source, /openSupplementAction\('quick-yes'/);
  assert.match(source, /openSupplementAction\('snooze'/);
  assert.match(source, /data: \{ url \}/);
  assert.match(source, /tag === 'fuel-supplements-auth'/);
  assert.equal(source.includes("Snooze skipped, no auth token"), false);
});
