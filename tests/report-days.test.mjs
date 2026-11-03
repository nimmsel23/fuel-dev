import test from 'node:test';
import assert from 'node:assert/strict';
import { localISO, shiftISO, reportDates, loadReportDays } from '../src/client/views/Report/reportDates.mjs';

test('report range follows calendar dates across year and DST boundaries', () => {
  assert.equal(localISO(new Date(2026, 0, 1, 0, 15)), '2026-01-01');
  assert.deepEqual(reportDates('2026-03-28', '2026-03-30'), ['2026-03-28', '2026-03-29', '2026-03-30']);
  assert.equal(shiftISO('2025-12-31', 1), '2026-01-01');
  assert.equal(reportDates('2026-02-30', '2026-03-01'), null);
  assert.equal(reportDates('2026-02-01', '2026-01-01'), null);
  assert.equal(reportDates('2020-01-01', '2022-01-01'), null);
});

test('report loads the requested dates and propagates failed reads', async () => {
  const dates = ['2020-01-01', '2020-01-02'];
  const logs = await loadReportDays(dates, async date => ({ date, meals: date.endsWith('01') ? [{ kcal: 42 }] : [] }));
  assert.equal(logs['2020-01-01'].meals[0].kcal, 42);
  assert.deepEqual(logs['2020-01-02'].meals, []);
  await assert.rejects(loadReportDays(dates, async date => { if (date.endsWith('02')) throw Error('offline'); return {}; }), /offline/);
});
