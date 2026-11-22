import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { selectDueSupplements, buildSingleSupplementPayload } = require("../functions/supplement-reminders.js");

const SETTINGS = {
  supplement_push_enabled: true,
  supplement_push_morning_time: "08:00",
  supplement_push_midday_time: "13:00",
  supplement_push_evening_time: "19:00",
  supplement_push_night_time: "21:00",
};
const NOW = Date.UTC(2026, 10, 22, 7, 2);
const daily = (id, time_of_day = "morning", extra = {}) => ({
  id, name: id, default_time_of_day: time_of_day, default_dose: 400, unit: "mg", schedule: { type: "daily" }, ...extra,
});

function select(over = {}) {
  return selectDueSupplements({
    catalog: [], intakes: [], snoozed: {}, settings: SETTINGS,
    dateObj: new Date("2026-11-22"), currentMinutes: 8 * 60 + 2, nowMs: NOW, windowMinutes: 5, ...over,
  }).map(({ item, reason }) => `${item.id}:${reason}`);
}

test("jedes fällige Supplement des Slots einzeln", () => {
  assert.deepEqual(select({ catalog: [daily("mag"), daily("d3"), daily("zink", "evening")] }), ["mag:scheduled", "d3:scheduled"]);
});

test("geloggt, Erinnerung aus, nicht heute oder global aus → keine Nachricht", () => {
  const catalog = [
    daily("mag"),
    daily("off", "morning", { reminder: { enabled: false } }),
    daily("weekly", "morning", { schedule: { type: "weekly", days: ["mon"] } }),
  ];
  assert.deepEqual(select({ catalog, intakes: [{ supplement_id: "mag" }] }), []);
  assert.deepEqual(select({ catalog: [daily("mag")], settings: { ...SETTINGS, supplement_push_enabled: false } }), []);
});

test("eigene Uhrzeit ersetzt die Slot-Uhrzeit", () => {
  const item = daily("omega", "morning", { reminder: { enabled: true, time: "10:15" } });
  assert.deepEqual(select({ catalog: [item] }), []);
  assert.deepEqual(select({ catalog: [item], currentMinutes: 10 * 60 + 17 }), ["omega:scheduled"]);
});

test("Später: still, solange Snooze läuft, einmal erneut nach Ablauf", () => {
  const catalog = [daily("mag")];
  assert.deepEqual(select({ catalog, snoozed: { mag: NOW + 60_000 } }), []);
  const later = { catalog, currentMinutes: 8 * 60 + 32 };
  assert.deepEqual(select({ ...later, snoozed: { mag: NOW - 60_000 } }), ["mag:snooze"]);
  assert.deepEqual(select({ ...later, snoozed: { mag: NOW - 6 * 60_000 } }), []);
});

test("Payload: eigener Tag, Ja/Später, genau ein due_item", () => {
  const p = buildSingleSupplementPayload({ uid: "u1", item: daily("mag"), dateStr: "2026-11-22", reason: "scheduled", url: "/" });
  assert.equal(p.tag, "fuel-supplement-mag");
  assert.equal(p.title, "💊 mag");
  assert.equal(p.body, "400 mg · Morgens");
  assert.deepEqual(p.actions.map((a) => a.action), ["quick-yes", "snooze"]);
  assert.deepEqual(p.meta.due_items.map((i) => i.id), ["mag"]);
  assert.equal(p.renotify, false);
  assert.equal(buildSingleSupplementPayload({ uid: "u1", item: daily("mag"), dateStr: "x", reason: "snooze", url: "/" }).renotify, true);
});
