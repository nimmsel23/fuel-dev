import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patchNutritionDay } from '../src/client/lib/optimisticMeal.js';

// Minimaler QueryClient-Ersatz: genau die zwei Methoden, die der Helfer benutzt.
function fakeQc(initial) {
  const store = new Map(Object.entries(initial || {}));
  return {
    cancelled: [],
    async cancelQueries({ queryKey }) { this.cancelled.push(queryKey.join('|')); },
    setQueryData(queryKey, updater) { const k = queryKey.join('|'); store.set(k, updater(store.get(k))); },
    getQueryData(queryKey) { return store.get(queryKey.join('|')); },
  };
}

test('Hinzufügen: Mahlzeit erscheint sofort im Tages-Cache, laufende Abfragen werden abgebrochen', async () => {
  const qc = fakeQc({ 'nutrition|2026-10-16': { date: '2026-10-16', meals: [{ id: 'a' }] } });
  await patchNutritionDay(qc, '2026-10-16', { meal: { id: 'b', description: 'Skyr', logged_at: 'x' } });
  assert.deepEqual(qc.getQueryData(['nutrition', '2026-10-16']).meals.map(m => m.id), ['a', 'b']);
  assert.deepEqual(qc.cancelled, ['nutrition|2026-10-16']);
});

test('Cache noch leer: Tag wird angelegt', async () => {
  const qc = fakeQc();
  await patchNutritionDay(qc, '2026-10-16', { meal: { id: 'b' } });
  assert.deepEqual(qc.getQueryData(['nutrition', '2026-10-16']).meals, [{ id: 'b' }]);
});

test('Ändern: nur die Mahlzeit mit der ID wird ersetzt, Rest bleibt', async () => {
  const qc = fakeQc({ 'nutrition|d': { date: 'd', meals: [{ id: 'a', kcal: 1 }, { id: 'b', kcal: 2 }] } });
  await patchNutritionDay(qc, 'd', { meal_id: 'b', meal: { kcal: 9, logged_at: 'y' } });
  assert.deepEqual(qc.getQueryData(['nutrition', 'd']).meals, [{ id: 'a', kcal: 1 }, { id: 'b', kcal: 9, logged_at: 'y' }]);
});

test('Löschen: Mahlzeit verschwindet sofort und wird als gelöscht vermerkt', async () => {
  const qc = fakeQc({ 'nutrition|d': { date: 'd', meals: [{ id: 'a' }, { id: 'b' }] } });
  await patchNutritionDay(qc, 'd', { delete_meal_id: 'a' });
  const day = qc.getQueryData(['nutrition', 'd']);
  assert.deepEqual(day.meals.map(m => m.id), ['b']);
  assert.deepEqual(day.deleted_meal_ids, ['a']);
});

test('Ungültiger Befehl (Eintrag existiert nicht mehr): Cache bleibt unverändert, kein Fehler', async () => {
  const before = { date: 'd', meals: [{ id: 'a' }] };
  const qc = fakeQc({ 'nutrition|d': before });
  await patchNutritionDay(qc, 'd', { meal_id: 'weg', meal: { kcal: 1 } });
  assert.equal(qc.getQueryData(['nutrition', 'd']), before);
});

test('derselbe Befehl zweimal (Doppeltipp/Replay): kein doppelter Eintrag', async () => {
  const qc = fakeQc({ 'nutrition|d': { date: 'd', meals: [] } });
  const cmd = { meal: { id: 'x' } };
  await patchNutritionDay(qc, 'd', cmd); await patchNutritionDay(qc, 'd', cmd);
  assert.equal(qc.getQueryData(['nutrition', 'd']).meals.length, 1);
});
