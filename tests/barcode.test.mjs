import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBarcode, lookupBarcode, decodeBarcode } from '../src/client/lib/barcode.js';
const product = { product_name: 'Milk', brands: 'Example', nutriments: { 'energy-kcal_100g': 60, proteins_100g: 3.5, carbohydrates_100g: 4.5, fat_100g: 3.2 } };
const cache = new Map();
globalThis.localStorage = { getItem: k => cache.get(k), setItem: (k,v) => cache.set(k,v) };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });

test('GTIN validation preserves leading zeros and rejects invalid input', () => {
  assert.equal(normalizeBarcode(' 4006381333931 '), '4006381333931');
  assert.equal(normalizeBarcode('036000291452'), '036000291452');
  assert.throws(() => normalizeBarcode('4006381333932'), /Prüfziffer/);
  assert.throws(() => normalizeBarcode('hello4006381333931'));
});

test('lookup uses product data and cache works offline without another request', async () => {
  let requests = 0;
  globalThis.fetch = async () => { requests++; return { ok: true, json: async () => ({ status: 1, product }) }; };
  const result = await lookupBarcode('4006381333931');
  assert.equal(result.kcal, 60); assert.equal(result.grams, 100); assert.equal(result.source, 'openfoodfacts');
  navigator.onLine = false;
  assert.deepEqual(await lookupBarcode('4006381333931'), result); assert.equal(requests, 1);
  await assert.rejects(lookupBarcode('036000291452'), /Offline/);
});

test('unknown products and missing nutrients produce actionable errors', async () => {
  cache.clear(); navigator.onLine = true;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ status: 0 }) });
  await assert.rejects(lookupBarcode('4006381333931'), /nicht.*gefunden/);
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ status: 1, product: { ...product, nutriments: {} } }) });
  await assert.rejects(lookupBarcode('4006381333931'), /fehlen/);
  assert.equal(cache.size, 0);
});

test('native decoder closes image resources and handles unsupported browsers', async () => {
  await assert.rejects(decodeBarcode({}), /Nummer/);
  let closed = false;
  globalThis.createImageBitmap = async () => ({ close: () => { closed = true; } });
  globalThis.BarcodeDetector = class {
    static async getSupportedFormats() { return ['ean_13']; }
    async detect() { return [{ rawValue: '4006381333931' }]; }
  };
  assert.equal(await decodeBarcode({}), '4006381333931'); assert.equal(closed, true);
});
