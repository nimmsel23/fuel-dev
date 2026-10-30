import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Run the real browser pipeline with deterministic SDK/Canvas boundaries.
const fake = globalThis.__fuelVisionTest = { calls: [], writes: [], canvases: [] };
const bundle = await build({
  entryPoints: [new URL('../src/client/lib/visionScan.js', import.meta.url).pathname],
  bundle: true, write: false, format: 'esm', platform: 'browser',
  define: { 'import.meta.env.VITE_APP_MODE': '"client"' },
  plugins: [{ name: 'sdk-boundaries', setup(b) {
    b.onResolve({ filter: /^(@api|firebase\/vertexai|\.\/firebase\.js)$/ }, args => ({ path: args.path, namespace: 'fake' }));
    b.onLoad({ filter: /.*/, namespace: 'fake' }, args => ({ contents: args.path === '@api'
      ? 'export const postJson = async (...args) => { globalThis.__fuelVisionTest.writes.push(args); throw Error("Unexpected write"); };'
      : args.path === './firebase.js' ? 'export const vertexAI = {};'
        : `export const SchemaType = Object.fromEntries(['OBJECT','ARRAY','STRING','NUMBER'].map(k => [k,k]));
           export const getGenerativeModel = (ai, config) => { globalThis.__fuelVisionTest.config = config; return {
             generateContent: async input => { globalThis.__fuelVisionTest.calls.push(input); return { response: { text: () => JSON.stringify(globalThis.__fuelVisionTest.response) } }; }
           }; };` }));
  } }],
});
const { analyzeMealImage } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
globalThis.Image = class {
  width = 4000; height = 3000;
  set src(value) { queueMicrotask(() => this.onload()); }
};
globalThis.document = { createElement: () => {
  const canvas = { getContext: () => ({ drawImage() {} }), toDataURL(type, quality) {
    fake.canvases.push({ width: this.width, height: this.height, quality });
    return 'data:image/jpeg;base64,dGVzdA==';
  } }; return canvas;
} };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });

test('photo analysis returns normalized ingredients and micros without writing a meal', async () => {
  fake.response = { name: 'Rice bowl', grams: 300, macros: { kcal: 400, protein: 20, carbs: 60, fat: 9 }, micros: { calcium_mg: 42 }, components: [{ name: 'Rice', qty: '200g gekocht', kcal: 260, carbs: 56 }] };
  const meal = await analyzeMealImage(new Blob(['photo'], { type: 'image/jpeg' }));
  assert.equal(meal.components[0].amount_g, 200);
  assert.equal(meal.components[0].qty_text, '200g gekocht');
  assert.deepEqual(meal.micros, { calcium_mg: 42 });
  assert.deepEqual(fake.writes, []);
  assert.equal(fake.config.generationConfig.responseSchema.properties.components.type, 'ARRAY');
  assert.ok(fake.config.generationConfig.responseSchema.required.includes('components'));
  assert.deepEqual(fake.canvases.at(-1), { width: 1280, height: 960, quality: 0.82 });
  await analyzeMealImage(new Blob(['label']), { scanType: 'label' });
  assert.deepEqual(fake.canvases.at(-1), { width: 2048, height: 1536, quality: 0.92 });
});

test('offline analysis never contacts Gemini; bad responses never become meals', async () => {
  const before = fake.calls.length;
  navigator.onLine = false;
  await assert.rejects(analyzeMealImage(new Blob(['photo'])), /Offline/);
  assert.equal(fake.calls.length, before);
  navigator.onLine = true;
  fake.response = { macros: { kcal: -100 } };
  await assert.rejects(analyzeMealImage(new Blob(['photo'])), /ungültige Nährwerte/);
  assert.deepEqual(fake.writes, []);
});
