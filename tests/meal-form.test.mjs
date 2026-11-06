import test from 'node:test';
import assert from 'node:assert/strict';
import { nowHHMM, emptyForm, hhmmFromISO } from '../src/client/lib/mealForm.js';

test('nowHHMM liefert HH:MM mit fuehrenden Nullen', () => {
  assert.match(nowHHMM(), /^\d{2}:\d{2}$/);
});

test('emptyForm: leere Felder, Frühstück, aktuelle Zeit, jedes Mal neues Objekt', () => {
  const a = emptyForm();
  assert.equal(a.id, null);
  assert.equal(a.type, 'breakfast');
  assert.equal(a.description, '');
  assert.match(a.time, /^\d{2}:\d{2}$/);
  assert.notEqual(emptyForm(), a);
});

test('hhmmFromISO: lokale Uhrzeit aus ISO; leer/ungueltig faellt auf jetzt zurueck', () => {
  const d = new Date(2026, 10, 6, 7, 5, 0);
  assert.equal(hhmmFromISO(d.toISOString()), '07:05');
  assert.match(hhmmFromISO(''), /^\d{2}:\d{2}$/);
  assert.match(hhmmFromISO('kaputt'), /^\d{2}:\d{2}$/);
});
