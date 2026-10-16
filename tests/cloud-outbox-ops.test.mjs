import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCatalogOp, mergeMicros, projectCatalogItems, projectNotesContent, streamOf, isLogKind } from '../src/client/lib/cloudOutboxOps.js';

test('Katalog-Upsert: neu anhängen, per ID ersetzen, per Name die bestehende ID behalten', () => {
  const base = [{ id: 'a', name: 'Haferflocken' }];
  assert.deepEqual(applyCatalogOp(base, { op: 'upsert', item: { id: 'b', name: 'Skyr' } }).map(i => i.id), ['a', 'b']);
  assert.equal(applyCatalogOp(base, { op: 'upsert', item: { id: 'a', name: 'Hafer' } })[0].name, 'Hafer');
  const byName = applyCatalogOp(base, { op: 'upsert', matchName: true, item: { id: 'neu', name: '  haferflocken ' } });
  assert.equal(byName.length, 1); assert.equal(byName[0].id, 'a');
  // ohne matchName (Supplements) bleibt ein Namens-Duplikat bewusst ein zweiter Eintrag
  assert.equal(applyCatalogOp(base, { op: 'upsert', item: { id: 'neu', name: 'Haferflocken' } }).length, 2);
});

test('Katalog-Operationen sind idempotent (Replay nach Absturz/zwei Tabs)', () => {
  const ops = [{ op: 'upsert', item: { id: 'x', name: 'Kreatin' } }, { op: 'delete', id: 'a' }];
  const once = ops.reduce(applyCatalogOp, [{ id: 'a', name: 'Alt' }]);
  const twice = [...ops, ...ops].reduce(applyCatalogOp, [{ id: 'a', name: 'Alt' }]);
  assert.deepEqual(once, twice);
});

test('Katalog: Eingabe wird nicht mutiert, ungültige Operation wirft', () => {
  const base = Object.freeze([{ id: 'a', name: 'A' }]);
  assert.doesNotThrow(() => applyCatalogOp(base, { op: 'delete', id: 'a' }));
  assert.throws(() => applyCatalogOp(base, { op: 'foo' }), /Ungültige/);
});

test('Mikros: gleicher meal_name ersetzt, neuer wird angehängt, idempotent', () => {
  const existing = [{ meal_name: 'A', v: 1 }, { meal_name: 'B', v: 1 }];
  const incoming = [{ meal_name: 'B', v: 2 }, { meal_name: 'C', v: 1 }];
  const merged = mergeMicros(existing, incoming);
  assert.deepEqual(merged, [{ meal_name: 'A', v: 1 }, { meal_name: 'B', v: 2 }, { meal_name: 'C', v: 1 }]);
  assert.deepEqual(mergeMicros(merged, incoming), merged);
});

test('Projektion: offene Katalog-Änderungen sichtbar, geblockte nicht, nur passende Katalogart', () => {
  const entries = [
    { kind: 'catalog:nutrition', command: { op: 'upsert', item: { id: 'n1', name: 'Neu' } } },
    { kind: 'catalog:nutrition', blocked: true, command: { op: 'delete', id: 'a' } },
    { kind: 'catalog:supplements', command: { op: 'upsert', item: { id: 's1', name: 'Fremd' } } },
  ];
  assert.deepEqual(projectCatalogItems('nutrition', [{ id: 'a', name: 'A' }], entries).map(i => i.id), ['a', 'n1']);
});

test('Projektion Notizen: letzte offene Notiz des Tages gewinnt', () => {
  const entries = [
    { kind: 'notes', date: '2026-10-16', command: { content: 'erste' } },
    { kind: 'notes', date: '2026-10-16', command: { content: 'zweite' } },
    { kind: 'notes', date: '2026-10-15', command: { content: 'anderer Tag' } },
  ];
  assert.equal(projectNotesContent('alt', '2026-10-16', entries), 'zweite');
  assert.equal(projectNotesContent('alt', '2026-10-14', entries), 'alt');
});

test('Ströme: Logs gemeinsam, Notizen je Tag, Rest je Art', () => {
  assert.equal(streamOf({ kind: 'nutrition' }), 'log'); assert.equal(streamOf({ kind: 'supplements' }), 'log');
  assert.equal(streamOf({ kind: 'notes', date: 'd' }), 'notes:d');
  assert.equal(streamOf({ kind: 'catalog:nutrition' }), 'catalog:nutrition');
  assert.ok(isLogKind('nutrition') && !isLogKind('micros'));
});
