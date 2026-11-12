import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateWeek,
  calendarDay,
  datesOfISOWeek,
  isoWeekOf,
  rollActiveDate,
  shiftCalendarDay,
  weekDates,
} from "../src/client/lib/calendarDay.js";
import { mergeHistoryWithPending } from "../src/client/lib/historyLogs.js";
import { buildWeekGroups } from "../src/client/views/History/historyWeeks.mjs";

test("Vienna midnight stays on the new civil day, not the previous UTC day", () => {
  assert.equal(calendarDay(new Date("2026-11-08T23:30:00Z")), "2026-11-09");
  assert.equal(calendarDay(new Date("2026-11-08T22:30:00Z")), "2026-11-08");
  assert.equal(calendarDay(new Date("2026-03-28T23:30:00Z")), "2026-03-29");
  assert.equal(calendarDay(new Date("2026-10-24T22:30:00Z")), "2026-10-25");
});

test("week aggregation keeps Monday after midnight and sums the Vienna week", () => {
  const today = calendarDay(new Date("2026-11-08T23:30:00Z"));
  assert.equal(today, "2026-11-09");
  const week = aggregateWeek(today, {
    "2026-11-08": { meals: [{ id: "sun", kcal: 900, protein: 40, carbs: 80, fat: 30 }], water_ml: 0 },
    "2026-11-09": { meals: [{ id: "mon", kcal: 400, protein: 30, carbs: 40, fat: 12 }], water_ml: 200 },
    "2026-11-10": { meals: [], water_ml: 750 },
    "2026-11-11": { meals: [{ id: "wed", kcal: 100.2, protein: 5, carbs: 10, fat: 2 }], water_ml: 0 },
  });
  assert.deepEqual(week.dates, [
    "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15",
  ]);
  assert.equal(week.days.some((day) => day.date === "2026-11-08"), false);
  assert.equal(week.days[0].kcal, 400);
  assert.equal(week.days[0].protein, 30);
  assert.equal(week.days[1].waterOnly, true);
  assert.equal(week.days[1].visible, true);
  assert.equal(week.days[1].kcal, 0);
  assert.equal(week.days[2].kcal, 100.2);
  assert.equal(week.totals.kcal, 500.2);
  assert.equal(week.totals.protein, 35);
  assert.equal(week.totals.water_ml, 950);
  assert.deepEqual(isoWeekOf(today), { year: 2026, week: 46 });
  assert.deepEqual(weekDates("2026-11-15"), week.dates);
  assert.deepEqual(weekDates("2026-11-08"), [
    "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08",
  ]);
});

test("ISO week dates stay inverse across the year boundary and DST weeks", () => {
  assert.equal(datesOfISOWeek(2026, 1)[0], "2025-12-29");
  assert.deepEqual(isoWeekOf("2025-12-29"), { year: 2026, week: 1 });
  assert.deepEqual(datesOfISOWeek(2026, 45), [
    "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08",
  ]);
  for (let week = 1; week <= 53; week += 1) {
    const days = datesOfISOWeek(2026, week);
    if (days.length === 0) continue;
    assert.equal(days.length, 7);
    for (const day of days) assert.deepEqual(isoWeekOf(day), { year: 2026, week });
    assert.equal(shiftCalendarDay(days[0], 6), days[6]);
  }
  assert.equal(datesOfISOWeek(2026, 53).length, 7);
});

test("open app rolls today forward at midnight and leaves a chosen day", () => {
  assert.equal(rollActiveDate("2026-11-08", "2026-11-08", "2026-11-09"), "2026-11-09");
  assert.equal(rollActiveDate("2026-11-06", "2026-11-08", "2026-11-09"), "2026-11-06");
  assert.equal(rollActiveDate("2026-11-09", "2026-11-09", "2026-11-09"), "2026-11-09");
});

test("history week keeps Sunday, shows a water-only day, and labels the ISO week", () => {
  const groups = buildWeekGroups("2026-11-08", [
    { date: "2026-11-01", meals: [{ id: "prev" }] },
    { date: "2026-11-02", meals: [{ id: "mon" }] },
    { date: "2026-11-04", meals: [], water_ml: 500 },
    { date: "2026-11-08", meals: [{ id: "sun" }] },
  ]);
  assert.equal(groups[0].label, "Diese Woche");
  assert.deepEqual(groups[0].visibleDays, ["2026-11-08", "2026-11-04", "2026-11-02"]);
  assert.equal(groups[1].label, "Letzte Woche");
  assert.deepEqual(groups[1].visibleDays, ["2026-11-01"]);

  const older = buildWeekGroups("2026-01-12", [
    { date: "2025-12-29", meals: [], water_ml: 300 },
  ]);
  assert.equal(older.at(-1).label, "KW 1 · 2026");
  assert.deepEqual(older.at(-1).visibleDays, ["2025-12-29"]);
});

test("history keeps water-only days and pending meals on the Vienna date", () => {
  const visible = mergeHistoryWithPending(
    [
      { date: "2026-11-08", meals: [{ id: "sun", kcal: 100 }], water_ml: 0 },
      { date: "2026-11-07", meals: [], water_ml: 0 },
    ],
    [
      {
        kind: "nutrition",
        date: "2026-11-09",
        command: { water_ml: 750, water_delta: 750 },
      },
      {
        kind: "nutrition",
        date: "2026-11-10",
        command: { meal: { id: "mon", description: "Hafer", kcal: 350, protein: 12, carbs: 50, fat: 8 } },
      },
    ],
  );
  assert.equal(visible.some((day) => day.date === "2026-11-07"), false);
  assert.equal(visible.find((day) => day.date === "2026-11-09").water_ml, 750);
  assert.equal(visible.find((day) => day.date === "2026-11-09").meals.length, 0);
  assert.equal(visible.find((day) => day.date === "2026-11-10").meals[0].kcal, 350);
  const week = aggregateWeek("2026-11-09", Object.fromEntries(visible.map((day) => [day.date, day])));
  assert.equal(week.days.find((day) => day.date === "2026-11-09").waterOnly, true);
  assert.equal(week.days.find((day) => day.date === "2026-11-10").kcal, 350);
  assert.equal(week.days.some((day) => day.date === "2026-11-08"), false);
});
