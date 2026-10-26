import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toBaseUnit, formatQty, normDate, expiryStatus, mergeIntoPantry, pantryHas, addShoppingItems, markShoppingBought,
  normalizeReceiptResult, reviewToIncoming, activeDeals, normalizeDeals, normalizeRecipes, missingIngredients,
  groupByCategory, upsertById, normalizeName, buildRecipePrompt, normalizeCategory,
} from '../src/client/lib/kitchenLogic.js';

const ids = () => { let n = 0; return () => `id${++n}`; };
const NOW = '2026-10-26T10:00:00.000Z';
const opts = () => ({ today: '2026-10-26', now: NOW, makeId: ids() });

test('Einheiten: kg/l/dag werden in Basiseinheit umgerechnet, Unbekanntes zählt als Stück', () => {
  assert.deepEqual(toBaseUnit(1.5, 'kg'), { qty: 1500, unit: 'g' });
  assert.deepEqual(toBaseUnit(2, 'Liter'), { qty: 2000, unit: 'ml' });
  assert.deepEqual(toBaseUnit(20, 'dag'), { qty: 200, unit: 'g' });
  assert.deepEqual(toBaseUnit(3, 'Dosen'), { qty: 3, unit: 'Stk' });
  assert.deepEqual(toBaseUnit(undefined, 'Packung'), { qty: 1, unit: 'Pkg' });
  assert.deepEqual(toBaseUnit('x', 'irgendwas'), { qty: 1, unit: 'Stk' });
});

test('formatQty: ab 1000 g/ml in kg/l, Komma als Dezimaltrenner', () => {
  assert.equal(formatQty(1500, 'g'), '1,5 kg');
  assert.equal(formatQty(250, 'g'), '250 g');
  assert.equal(formatQty(1000, 'ml'), '1 l');
  assert.equal(formatQty(2, 'Stk'), '2 Stk');
});

test('normDate: ISO und deutsches Datum, Müll wird leer', () => {
  assert.equal(normDate('2026-10-26'), '2026-10-26');
  assert.equal(normDate('5.11.26'), '2026-11-05');
  assert.equal(normDate('26.10.2026'), '2026-10-26');
  assert.equal(normDate('2026-13-45'), '');
  assert.equal(normDate('morgen'), '');
});

test('expiryStatus: abgelaufen / heute / bald / ok / ohne Datum', () => {
  const t = '2026-10-26';
  assert.equal(expiryStatus('2026-10-25', t).status, 'expired');
  assert.equal(expiryStatus('2026-10-26', t).status, 'today');
  assert.deepEqual(expiryStatus('2026-10-28', t), { status: 'soon', days: 2 });
  assert.equal(expiryStatus('2026-11-10', t).status, 'ok');
  assert.equal(expiryStatus('', t).status, 'none');
});

test('mergeIntoPantry: gleicher Name + Einheit addiert Menge, frühestes Ablaufdatum gewinnt', () => {
  const first = mergeIntoPantry([], [{ name: 'vollmilch', qty: 1, unit: 'l', category: 'milch_eier', expires_on: '2026-11-05' }], opts());
  assert.equal(first.items.length, 1);
  assert.equal(first.items[0].name, 'Vollmilch');
  assert.equal(first.items[0].qty, 1000);
  const second = mergeIntoPantry(first.items, [{ name: 'Vollmilch', qty: 500, unit: 'ml', expires_on: '2026-11-01' }], opts());
  assert.equal(second.items.length, 1);
  assert.equal(second.items[0].qty, 1500);
  assert.equal(second.items[0].expires_on, '2026-11-01');
  assert.deepEqual(second.changed.map((i) => i.id), [first.items[0].id]);
});

test('mergeIntoPantry: andere Einheit oder aufgebrauchter Posten → neuer Eintrag; doppelte im selben Schwung werden zusammengefasst', () => {
  const base = mergeIntoPantry([], [{ name: 'Reis', qty: 500, unit: 'g' }], opts()).items;
  const r = mergeIntoPantry(base, [{ name: 'Reis', qty: 1, unit: 'Pkg' }, { name: 'Reis', qty: 1, unit: 'Pkg' }], opts());
  assert.equal(r.items.length, 2);
  assert.equal(r.items.find((i) => i.unit === 'Pkg').qty, 2);
  const empty = [{ ...base[0], qty: 0 }];
  assert.equal(mergeIntoPantry(empty, [{ name: 'Reis', qty: 100, unit: 'g' }], opts()).items.length, 2);
});

test('mergeIntoPantry: Preis/Händler/Quelle werden übernommen, leere Namen ignoriert', () => {
  const r = mergeIntoPantry([], [{ name: 'Eier', qty: 10, unit: 'Stk', price: '2.49', store: 'Billa', source: 'receipt' }, { name: '  ', qty: 1 }], opts());
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].price, 2.49);
  assert.equal(r.items[0].store, 'Billa');
  assert.equal(r.items[0].source, 'receipt');
  assert.equal('expires_on' in r.items[0], false);
});

test('pantryHas: Wortgrenzen statt Teilstring, aufgebrauchte Posten zählen nicht', () => {
  const pantry = [{ name: 'Jasminreis', qty: 500, unit: 'g' }, { name: 'Eier', qty: 0, unit: 'Stk' }, { name: 'Zwiebeln', qty: 3, unit: 'Stk' }];
  assert.equal(pantryHas(pantry, 'Jasminreis'), true);
  assert.equal(pantryHas(pantry, 'Reis'), false); // "reis" steckt nur als Teilwort in "jasminreis"
  assert.equal(pantryHas(pantry, 'Eier'), false);
  assert.equal(pantryHas(pantry, 'rote Zwiebeln'), true);
  assert.equal(pantryHas(pantry, 'Ei'), false);
});

test('Einkaufszettel: Duplikate offener Posten werden übersprungen, Bon hakt passende Posten ab', () => {
  const list = addShoppingItems([], [{ name: 'Milch' }, { name: 'milch' }, { name: 'Eier', reason: 'Protein' }], opts());
  assert.deepEqual(list.map((i) => i.name), ['Milch', 'Eier']);
  assert.equal(list[1].reason, 'Protein');
  assert.deepEqual(addShoppingItems(list, [{ name: 'Milch' }], opts()), []);
  const done = markShoppingBought(list, ['Vollmilch', 'Brot'], { now: NOW });
  assert.deepEqual(done.map((i) => i.name), ['Milch']);
  assert.equal(done[0].done, true);
  // erledigte Posten dürfen erneut auf den Zettel
  const again = addShoppingItems(done, [{ name: 'Milch' }], opts());
  assert.equal(again.length, 1);
});

test('normalizeReceiptResult: Nicht-Lebensmittel abgewählt, Summe/Datum-Fallbacks, Mengen normalisiert', () => {
  const r = normalizeReceiptResult({
    store: ' Billa ', date: 'kaputt', total: 0,
    items: [
      { raw_name: 'BIO VOLLMILCH 1L', name: 'vollmilch', qty: 1, unit: 'l', price: 1.69, category: 'milch_eier', is_food: true },
      { raw_name: 'TRAGETASCHE', name: 'Tragetasche', qty: 1, unit: 'Stk', price: 0.3, is_food: false },
      { raw_name: '', name: '' },
    ],
  }, { today: '2026-10-26' });
  assert.equal(r.store, 'Billa');
  assert.equal(r.date, '2026-10-26');
  assert.equal(r.total, 1.99);
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].qty, 1000);
  assert.equal(r.items[0].unit, 'ml');
  assert.equal(r.items[0].sel, true);
  assert.equal(r.items[1].sel, false);
  const incoming = reviewToIncoming(r.items, { store: r.store, date: r.date });
  assert.deepEqual(incoming.map((i) => i.name), ['Vollmilch']);
  assert.equal(incoming[0].source, 'receipt');
  assert.equal(incoming[0].bought_on, '2026-10-26');
});

test('Aktionen: abgelaufene verschwinden, ohne Datum gilt 7 Tage ab Einlesen', () => {
  const deals = [
    { id: 'a', product: 'Lachs', valid_until: '2026-10-25' },
    { id: 'b', product: 'Skyr', valid_until: '2026-10-26' },
    { id: 'c', product: 'Nüsse', created_at: '2026-10-20T08:00:00Z' },
    { id: 'd', product: 'Käse', created_at: '2026-10-10T08:00:00Z' },
  ];
  assert.deepEqual(activeDeals(deals, '2026-10-26').map((d) => d.id), ['b', 'c']);
  const parsed = normalizeDeals({ deals: [{ product: 'lachs', price: '3,99', valid_until: '30.10.2026' }, { product: '' }] }, { fallbackStore: 'Spar' });
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].store, 'Spar');
  assert.equal(parsed[0].valid_until, '2026-10-30');
  assert.equal(parsed[0].product, 'Lachs');
});

test('Rezepte: "im Vorrat" wird gegen den echten Vorrat geprüft, Salz zählt immer', () => {
  const pantry = [{ name: 'Eier', qty: 6, unit: 'Stk' }, { name: 'Reis', qty: 500, unit: 'g' }];
  const [r] = normalizeRecipes({ recipes: [{
    title: 'Reiseier', servings: 2, macros: { kcal: 520.4, protein: 28 },
    ingredients: [{ name: 'Eier', in_pantry: false }, { name: 'Speck', in_pantry: true }, { name: 'Salz' }],
    steps: ['Braten', ''],
  }, { title: '' }] }, pantry);
  assert.deepEqual(r.ingredients.map((i) => i.in_pantry), [true, false, true]);
  assert.deepEqual(missingIngredients(r).map((i) => i.name), ['Speck']);
  assert.equal(r.macros.kcal, 520);
  assert.deepEqual(r.steps, ['Braten']);
});

test('Prompt: enthält Vorrat, Profil, Wünsche und nur echte Aktionen', () => {
  const pantry = [{ name: 'Skyr', qty: 500, unit: 'g', expires_on: '2026-10-27' }];
  const p = buildRecipePrompt({ pantry, wishes: 'high protein', settings: { diet_type: 'omnivor', intolerances: 'Laktose' }, today: '2026-10-26' });
  assert.match(p, /Skyr: 500 g \[läuft bald ab: 2026-10-27\]/);
  assert.match(p, /Laktose/);
  assert.match(p, /high protein/);
  assert.doesNotMatch(p, /Aktuelle Aktionen/);
  const withDeal = buildRecipePrompt({ pantry, deals: [{ product: 'Lachs', price_text: '3,99 €', store: 'Spar', valid_until: '2026-10-30' }], today: '2026-10-26' });
  assert.match(withDeal, /Lachs \(3,99 €\) bei Spar bis 2026-10-30/);
});

test('Listenhelfer: Gruppierung nach Kategorie, upsertById, Normalisierung', () => {
  const groups = groupByCategory([{ id: '1', name: 'Zwiebel', category: 'obst_gemuese' }, { id: '2', name: 'Apfel', category: 'obst_gemuese' }, { id: '3', name: 'X', category: 'unbekannt' }]);
  assert.deepEqual(groups.map((g) => g.key), ['obst_gemuese', 'sonstiges']);
  assert.deepEqual(groups[0].items.map((i) => i.name), ['Apfel', 'Zwiebel']);
  assert.deepEqual(upsertById([{ id: '1', qty: 1, name: 'a' }], [{ id: '1', qty: 2 }, { id: '2', name: 'b' }]), [{ id: '1', qty: 2, name: 'a' }, { id: '2', name: 'b' }]);
  assert.equal(normalizeName('  Bio-Milch (3,5%) '), 'bio milch 3 5');
  assert.equal(normalizeCategory('Tiefkühl'), 'tiefkuehl');
});
