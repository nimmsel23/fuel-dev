import test from 'node:test';
import assert from 'node:assert/strict';
import { isDueToday, routineProgress } from '../src/client/views/Supplements/utils.js';
import { summarizeSupplementLogs } from '../src/client/views/Supplements/stats.js';

test('cycles start on their start date and never repeat into the past', () => {
  const item = { schedule: { type: 'cyclical', start_date: '2026-10-16', interval_days: 2 } };
  assert.equal(isDueToday(item, '2026-10-14'), false);
  assert.equal(isDueToday(item, '2026-10-16'), true);
  assert.equal(isDueToday(item, '2026-10-17'), false);
  assert.equal(isDueToday(item, '2026-10-18'), true);
  assert.equal(isDueToday({ schedule: { ...item.schedule, interval_days: 0 } }, '2026-10-16'), false);
  assert.equal(isDueToday(item, '2026-02-30'), false);
});
test('weekly dates are calendar dates regardless of timezone', () => {
  const item = { schedule: { type: 'weekly', days: ['fri'] } };
  assert.equal(isDueToday(item, '2026-10-16'), true);
  assert.equal(isDueToday(item, '2026-10-17'), false);
});
test('routine progress ignores extra doses and unscheduled products', () => {
  const catalog = [{ id: 'a', schedule: { type: 'daily' } }, { id: 'b', schedule: { type: 'daily' } }, { id: 'c' }];
  const result = routineProgress(catalog, [{ supplement_id: 'a' }, { supplement_id: 'a' }, { supplement_id: 'c' }], '2026-10-16');
  assert.equal(result.completed, 1);
  assert.equal(result.remaining, 1);
  assert.equal(result.percent, 50);
});
test('stats count unique days in the requested window and retain zero-count products', () => {
  const dates = ['2026-10-16', '2026-10-15', '2026-10-14'];
  const logs = { '2026-10-17': { intakes: [{ supplement_id: 'a' }] }, '2026-10-15': { intakes: [{ supplement_id: 'a' }, { supplement_id: 'a' }] }, '2026-10-14': { intakes: [{ supplement_id: 'a' }] } };
  const rows = summarizeSupplementLogs([{ id: 'a' }, { id: 'b' }], logs, dates, '2026-10-16');
  assert.equal(rows[0].days_taken, 2);
  assert.equal(rows[0].current_streak, 2);
  assert.equal(rows[1].days_taken, 0);
  assert.equal(summarizeSupplementLogs([{ id: 'a' }], logs, dates, '2026-11-01')[0].current_streak, 0);
});

test('optimistic commands are idempotent and rolling back one preserves concurrent work', async () => {
  const { applyIntakeCommand, undoIntakeCommand } = await import('../src/client/views/Supplements/optimistic.js');
  const a = { intake: { id: 'a', supplement_id: 'one' } };
  const b = { intake: { id: 'b', supplement_id: 'two' } };
  let log = applyIntakeCommand({ intakes: [] }, a);
  log = applyIntakeCommand(log, a);
  log = applyIntakeCommand(log, b);
  assert.equal(log.intakes.length, 2);
  assert.deepEqual(undoIntakeCommand(log, a).intakes.map(item => item.id), ['b']);
  const deleted = applyIntakeCommand(log, { delete_id: 'a' });
  assert.deepEqual(deleted.intakes.map(item => item.id), ['b']);
  assert.deepEqual(undoIntakeCommand(deleted, { delete_id: 'a' }, a.intake).intakes.map(item => item.id), ['b', 'a']);
});
