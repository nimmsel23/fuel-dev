import test from "node:test";
import assert from "node:assert/strict";
import { datesEndingAt, shiftLocalISO, todayISO } from "../../backend/fuel/src/shared/utils/validation.mjs";
import { dateToISOWeek, getWeekDates } from "../src/client/lib/db/firestore/utils.js";
import { buildWeekGroups } from "../src/client/views/History/historyWeeks.mjs";

test("ISO week 45 of 2026 is Monday 2 Nov through Sunday 8 Nov in local time", () => {
  assert.deepEqual(getWeekDates(2026, 45), [
    "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08",
  ]);
  assert.deepEqual(dateToISOWeek("2026-11-08"), { year: 2026, week: 45 });
  assert.deepEqual(dateToISOWeek("2026-11-02"), { year: 2026, week: 45 });
});

test("week dates and week numbers stay inverse across a year boundary", () => {
  assert.equal(getWeekDates(2026, 1)[0], "2025-12-29");
  assert.deepEqual(dateToISOWeek("2025-12-29"), { year: 2026, week: 1 });
  for (let week = 1; week <= 52; week += 1) {
    const days = getWeekDates(2026, week);
    assert.equal(days.length, 7);
    for (const day of days) assert.deepEqual(dateToISOWeek(day), { year: 2026, week });
    assert.equal(shiftLocalISO(days[0], 6), days[6]);
  }
});

test("trailing date lists keep the anchor as the last local day", () => {
  assert.deepEqual(datesEndingAt("2026-11-08", 3), ["2026-11-06", "2026-11-07", "2026-11-08"]);
  assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/);
});

test("history week keeps the local Sunday and drops the previous Sunday", () => {
  const groups = buildWeekGroups("2026-11-08", [
    { date: "2026-11-01", meals: [{ id: "prev" }] },
    { date: "2026-11-02", meals: [{ id: "mon" }] },
    { date: "2026-11-08", meals: [{ id: "sun" }] },
  ]);
  assert.equal(groups[0].label, "Diese Woche");
  assert.deepEqual(groups[0].visibleDays, ["2026-11-08", "2026-11-02"]);
  assert.equal(groups[1].label, "Letzte Woche");
  assert.deepEqual(groups[1].visibleDays, ["2026-11-01"]);
});
