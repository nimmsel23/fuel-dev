import test from 'node:test';
import assert from 'node:assert/strict';
import { buildJournalCheckPrompt, parseJournalCheckResponse } from '../src/client/lib/journalCheck.js';

test('Prompt listet geloggte Mahlzeiten als Liste und enthält den Tagebuchtext', () => {
  const prompt = buildJournalCheckPrompt('Haferflocken mit Banane', [
    { description: 'Haferflocken' },
    { description: 'Kaffee' },
  ]);
  assert.ok(prompt.includes('Haferflocken mit Banane'));
  assert.ok(prompt.includes('Bereits geloggt:\n- Haferflocken\n- Kaffee'));
  assert.ok(prompt.includes('Tagebuch:\n"""\nHaferflocken mit Banane\n"""'));
});

test('Ohne geloggte Mahlzeiten steht der Hinweis "(nichts geloggt)" statt einer Liste', () => {
  const prompt = buildJournalCheckPrompt('Apfel gegessen', []);
  assert.ok(prompt.includes('Bereits geloggt:\n(nichts geloggt)'));
});

test('Antwort: missing-Einträge kommen unverändert zurück', () => {
  const missing = [{ name: 'Apfel', kcal: 80, protein: 0, carbs: 20, fat: 0 }];
  assert.deepEqual(parseJournalCheckResponse(JSON.stringify({ missing })), missing);
});

test('Antwort ohne missing-Feld liefert leeres Array', () => {
  assert.deepEqual(parseJournalCheckResponse('{}'), []);
  assert.deepEqual(parseJournalCheckResponse('{"anderes": 1}'), []);
  assert.deepEqual(parseJournalCheckResponse('{"missing": null}'), []);
});

test('Antwort mit ungültigem JSON wirft (kein Stillschweigen)', () => {
  assert.throws(() => parseJournalCheckResponse('kein json'));
});
