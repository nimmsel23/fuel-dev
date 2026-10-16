const CACHE_PREFIX = "fuel:barcode:v1:";
const CACHE_AGE = 30 * 86400000;

export function normalizeBarcode(value) {
  const code = String(value || "").replace(/\s/g, "");
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) throw new Error("Bitte eine EAN/UPC mit 8, 12, 13 oder 14 Ziffern eingeben.");
  const digits = [...code].map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((total, n, i) => total + n * (i % 2 === 0 ? 3 : 1), 0);
  if ((10 - sum % 10) % 10 !== check) throw new Error("Die Prüfziffer des Barcodes stimmt nicht.");
  return code;
}

export async function decodeBarcode(file) {
  if (!("BarcodeDetector" in globalThis)) throw new Error("Dieser Browser erkennt keine Barcode-Fotos. Bitte die Nummer unten eingeben.");
  const supported = await BarcodeDetector.getSupportedFormats();
  const formats = ["ean_13", "ean_8", "upc_a", "itf"].filter(f => supported.includes(f));
  if (!formats.length) throw new Error("EAN/UPC-Fotos werden hier nicht unterstützt. Bitte die Nummer eingeben.");
  const bitmap = await createImageBitmap(file);
  try {
    const results = await new BarcodeDetector({ formats }).detect(bitmap);
    const codes = [...new Set(results.map(r => r.rawValue))];
    if (!codes.length) throw new Error("Kein Barcode erkannt. Bitte näher und scharf fotografieren oder die Nummer eingeben.");
    if (codes.length > 1) throw new Error("Mehrere Barcodes erkannt. Bitte nur einen Barcode fotografieren.");
    return normalizeBarcode(codes[0]);
  } finally { bitmap.close(); }
}

export function productToMeal(product, barcode) {
  const n = product.nutriments || {};
  const keys = ["energy-kcal_100g", "proteins_100g", "carbohydrates_100g", "fat_100g"];
  if (!product.product_name || keys.some(k => n[k] == null || !Number.isFinite(Number(n[k])) || Number(n[k]) < 0)) {
    throw new Error("Für dieses Produkt fehlen vollständige Nährwerte pro 100 g. Bitte Etikett fotografieren oder manuell erfassen.");
  }
  return {
    description: [product.product_name, product.brands].filter(Boolean).join(" · "),
    grams: 100, kcal: Number(n[keys[0]]), protein: Number(n[keys[1]]), carbs: Number(n[keys[2]]), fat: Number(n[keys[3]]),
    barcode, source: "openfoodfacts", source_url: `https://world.openfoodfacts.org/product/${barcode}`,
    micros_meta: { source: "openfoodfacts", method: "product_label", reference_grams: 100, barcode },
  };
}

export async function lookupBarcode(raw, { signal } = {}) {
  const barcode = normalizeBarcode(raw);
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_PREFIX + barcode));
    if (cached && Date.now() - cached.savedAt < CACHE_AGE) return productToMeal(cached.product, barcode);
  } catch { /* Invalid/disabled cache must not prevent an online lookup. */ }
  if (!navigator.onLine) throw new Error("Offline: Dieses Produkt ist noch nicht im Barcode-Cache.");
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=code,product_name,brands,nutriments`, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    headers: { Accept: "application/json" },
  });
  if (response.status === 404) throw new Error("Produkt nicht bei Open Food Facts gefunden.");
  if (!response.ok) throw new Error(`Produktabfrage fehlgeschlagen (${response.status}). Bitte erneut versuchen.`);
  const data = await response.json();
  if (data.status !== 1 || !data.product) throw new Error("Produkt nicht bei Open Food Facts gefunden.");
  const result = productToMeal(data.product, barcode);
  try { localStorage.setItem(CACHE_PREFIX + barcode, JSON.stringify({ product: data.product, savedAt: Date.now() })); } catch { /* Optional public-product cache. */ }
  return result;
}
