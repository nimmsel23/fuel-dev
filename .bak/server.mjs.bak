/**
 * FUEL CENTRE - Standalone Server (Port 9000)
 *
 * Zweck: Ernährungs-Tracking für Coach-Entwicklung & Klienten
 * - Coach nutzt lokal (Port 9000)
 * - Klienten nutzen via vital-hub (Port 4100: /c/<client>/fuel/)
 *
 * Features:
 * - POST /fuel/log — neue Mahlzeit/Snack loggen
 * - GET /fuel/progress — Fortschritt + alle Logs
 * - GET /fuel/log/list — alle Datums-Einträge
 * - Static file serving (PWA)
 *
 * Daten-Speicher: ~/dev/fuelctx/data/fuel/YYYY-MM-DD.json
 * Format: {datum, mahlzeit, speise, kalorien, protein, kohlenhydrate, fett, notizen}
 */

import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const STATIC_DIR = process.env.FUEL_STATIC_DIR ? path.resolve(process.env.FUEL_STATIC_DIR) : PUBLIC_DIR;
const DATA_DIR = process.env.AOS_FUEL_DATA_DIR
  ? path.resolve(process.env.AOS_FUEL_DATA_DIR)
  : path.join(process.env.HOME || process.env.USERPROFILE, ".aos", "fuel");
const FUEL_DIR = path.join(DATA_DIR, "fuel");
const NUTRITION_DIR = path.join(DATA_DIR, "nutrition");
const NUTRITION_JOURNAL_DIR = path.join(DATA_DIR, "nutrition_journal");
const NUTRITION_CATALOG_PATH = path.join(NUTRITION_DIR, "catalog.json");
const SUPPLEMENTS_DIR = path.join(DATA_DIR, "supplements");
const SUPPLEMENTS_LOG_DIR = path.join(SUPPLEMENTS_DIR, "logs");
const SUPPLEMENTS_CATALOG_PATH = path.join(SUPPLEMENTS_DIR, "catalog.json");

const PORT = Number(process.env.PORT || 9000);
const HOST = process.env.HOST || "127.0.0.1";
const VITE_ORIGIN = process.env.FUEL_VITE_ORIGIN || "";
const DEV_VITE_PREFIXES = ["/@vite", "/src/", "/node_modules/", "/vite.svg"];

const TEXT_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".mjs", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".ico", "image/x-icon"],
  [".woff2", "font/woff2"],
  [".woff", "font/woff"],
]);

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(FUEL_DIR)) fs.mkdirSync(FUEL_DIR, { recursive: true });
if (!fs.existsSync(NUTRITION_DIR)) fs.mkdirSync(NUTRITION_DIR, { recursive: true });
if (!fs.existsSync(NUTRITION_JOURNAL_DIR)) fs.mkdirSync(NUTRITION_JOURNAL_DIR, { recursive: true });
if (!fs.existsSync(SUPPLEMENTS_DIR)) fs.mkdirSync(SUPPLEMENTS_DIR, { recursive: true });
if (!fs.existsSync(SUPPLEMENTS_LOG_DIR)) fs.mkdirSync(SUPPLEMENTS_LOG_DIR, { recursive: true });

function getMimeType(pathname) {
  const ext = path.extname(pathname);
  return TEXT_TYPES.get(ext) || "application/octet-stream";
}

function serveFile(filePath, res) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
    return;
  }

  const mimeType = getMimeType(filePath);
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": mimeType });
  res.end(content);
}

function shouldProxyToVite(routedPath) {
  return Boolean(
    VITE_ORIGIN &&
    (routedPath === "/v2" ||
      routedPath === "/v2/" ||
      routedPath.startsWith("/v2/") ||
      DEV_VITE_PREFIXES.some((prefix) => routedPath === prefix || routedPath.startsWith(prefix))),
  );
}

function proxyToVite(req, res, routedPath) {
  const targetUrl = new URL(routedPath, VITE_ORIGIN);

  if (req.url.includes("?")) {
    targetUrl.search = req.url.slice(req.url.indexOf("?"));
  }

  const upstream = http.request(
    targetUrl,
    {
      method: req.method,
      headers: {
        ...req.headers,
        host: targetUrl.host,
      },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstream.on("error", (error) => {
    console.error("Vite proxy error:", error);
    sendJson(res, 502, { error: "vite dev server unavailable", origin: VITE_ORIGIN });
  });

  req.pipe(upstream);
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isISODate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function readJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function randomId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function sanitizeMetric(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 10) / 10;
}

function normalizeRoutedPath(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  const roots = new Set(["health", "fuel", "nutrition", "supplements", "public", "v2"]);

  if (parts.length >= 3 && parts[0] === "c" && parts[1] && roots.has(parts[2])) {
    return `/${parts.slice(2).join("/")}`;
  }
  if (parts.length >= 2 && parts[0] && !roots.has(parts[0]) && roots.has(parts[1])) {
    return `/${parts.slice(1).join("/")}`;
  }
  return `/${parts.join("/")}`;
}

function v2PreviewHtml() {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Fuel Centre v2</title>
  <style>
    :root{color-scheme:dark;font-family:Inter,system-ui,sans-serif}
    body{margin:0;min-height:100vh;background:radial-gradient(circle at top,#1f2937,#030712 55%);color:#e5e7eb}
    .wrap{max-width:960px;margin:0 auto;padding:40px 20px}
    .card{background:rgba(15,23,42,.78);border:1px solid rgba(255,255,255,.08);border-radius:24px;padding:28px;backdrop-filter:blur(14px)}
    .tag{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;background:rgba(249,115,22,.12);color:#fdba74;text-transform:uppercase;letter-spacing:.18em;font-size:12px}
    h1{font-size:clamp(2rem,5vw,4rem);line-height:1.05;margin:18px 0}
    p{color:#cbd5e1;max-width:70ch;line-height:1.6}
    .grid{display:grid;gap:14px;margin-top:24px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
    .panel{padding:18px;border-radius:20px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
    .panel strong{display:block;margin-bottom:8px}
    a{color:#fb923c;text-decoration:none}
    .actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}
    .btn{padding:12px 18px;border-radius:999px;background:#f97316;color:#08111f;font-weight:700}
    .btn.alt{background:transparent;color:#e5e7eb;border:1px solid rgba(255,255,255,.12)}
  </style>
</head>
<body>
  <main class="wrap">
    <section class="card">
      <div class="tag">v2 / Fuel Studio</div>
      <h1>Tailwind-first Nutrition Journal</h1>
      <p>
        Die neue Version ist als Vite-/Tailwind-Stack angelegt. Der bisherige Vanilla-Stand bleibt als
        <strong>v1 / Fuel Classic</strong> unter <code>/</code> bestehen.
      </p>
      <div class="actions">
        <a class="btn" href="/">Open v1 / Fuel Classic</a>
        <a class="btn alt" href="/health">API health</a>
      </div>
      <div class="grid">
        <div class="panel"><strong>Build target</strong><span>/opt/fuel</span></div>
        <div class="panel"><strong>UI stack</strong><span>React, Tailwind, FullCalendar, Query, Charts</span></div>
        <div class="panel"><strong>Next start</strong><span><code>npm run ui:dev</code> oder <code>npm run build</code></span></div>
      </div>
    </section>
  </main>
</body>
</html>`;
}

function getNutritionDayPath(date) {
  return path.join(NUTRITION_DIR, `${date}.json`);
}

const NUTRITION_CATALOG_DEFAULTS = [
  {
    id: "mcdonalds_at_double_cheeseburger_nice_price_menu",
    kind: "recipe",
    category: "restaurant",
    name: "McDonald's AT Double Cheeseburger Nice Price Menu",
    meal_type: "lunch",
    description: "Double Cheeseburger Nice Price Menu",
    notes: "McDonald's Austria; Burger + Pommes (mittel) + Coca-Cola 0,4l.",
    source: "mcdonalds.at",
    yield_g: null,
    components: [
      {
        id: "double_cheeseburger",
        label: "Double Cheeseburger",
        description: "Double Cheeseburger",
        brand: "McDonald's AT",
        grams: null,
        kcal: 457,
        protein: 27,
        carbs: 31,
        fat: 24,
        source: "mcdonalds.at",
        source_kind: "menu-item",
      },
      {
        id: "pommes_mittel",
        label: "Pommes (mittel)",
        description: "Pommes (mittel)",
        brand: "McDonald's AT",
        grams: null,
        kcal: 327,
        protein: 4.1,
        carbs: 41,
        fat: 15,
        source: "mcdonalds.at",
        source_kind: "menu-item",
      },
      {
        id: "coca_cola_0_4l",
        label: "Coca-Cola 0,4l",
        description: "Coca-Cola",
        brand: "McDonald's AT",
        grams: null,
        kcal: 106,
        protein: 0,
        carbs: 26,
        fat: 0,
        source: "mcdonalds.at",
        source_kind: "menu-item",
      },
    ],
  },
  {
    id: "spiegelei_5x",
    kind: "recipe",
    category: "jause",
    name: "Spiegelei 5x",
    meal_type: "breakfast",
    description: "Spiegelei 5x mit Jausenspeck und VK Brot",
    notes: "Basisvorlage mit Add-ons: Jausenspeck, mehr Jausenspeck, Dachsteinbrot.",
    source: "manual",
    yield_g: null,
    components: [
      {
        id: "bio_egg_5x",
        label: "Bio Eier 5x",
        description: "Bio Eier",
        brand: "BILLA AT",
        grams: null,
        kcal: 445,
        protein: 37.5,
        carbs: 3.5,
        fat: 32,
        source: "billa.at",
        source_kind: "base",
      },
    ],
    default_addon_ids: ["jausenspeck_25g", "dachsteinbrot_60g"],
    addons: [
      {
        id: "jausenspeck_25g",
        label: "Jausenspeck ca. 25g",
        description: "BILLA Schinkenspeck Geschnitten",
        brand: "BILLA AT",
        grams: 25,
        kcal: 70,
        protein: 6.8,
        carbs: 0,
        fat: 4.8,
        source: "billa.at",
        source_kind: "addon",
      },
      {
        id: "jausenspeck_40g",
        label: "Jausenspeck ca. 40g",
        description: "BILLA Schinkenspeck Geschnitten",
        brand: "BILLA AT",
        grams: 40,
        kcal: 112,
        protein: 10.8,
        carbs: 0,
        fat: 7.6,
        source: "billa.at",
        source_kind: "addon",
      },
      {
        id: "dachsteinbrot_60g",
        label: "Dachsteinbrot 2 dünne Scheiben",
        description: "Dachsteinbrot",
        brand: "Ströck / BILLA AT",
        grams: 60,
        kcal: 154,
        protein: 5.5,
        carbs: 18,
        fat: 5.6,
        source: "shop.billa.at",
        source_kind: "addon",
      },
    ],
  },
  {
    id: "billa_nacho_cheese_nuggets_mit_parboiled_reis_und_gemuese",
    kind: "recipe",
    category: "billa",
    name: "BILLA Nacho Cheese Nuggets mit Parboiled Reis und Gemüse",
    meal_type: "dinner",
    description: "Nacho Cheese Nuggets mit Parboiled Reis und Gemüse",
    notes: "Template-Wert; bei Bedarf mit Packungsangaben/Produktseite feinjustieren.",
    source: "manual",
    yield_g: null,
    components: [
      {
        id: "nacho_cheese_nuggets",
        label: "Nacho Cheese Nuggets",
        description: "Nacho Cheese Nuggets",
        brand: "BILLA AT",
        grams: null,
        kcal: 420,
        protein: 18,
        carbs: 30,
        fat: 24,
        source: "billa.at",
        source_kind: "base",
      },
      {
        id: "parboiled_reis_200g",
        label: "Parboiled Reis 200g",
        description: "Parboiled Reis gekocht",
        brand: "BILLA AT",
        grams: 200,
        kcal: 260,
        protein: 5.4,
        carbs: 57,
        fat: 0.5,
        source: "manual",
        source_kind: "addon",
      },
      {
        id: "gemuese_mix_150g",
        label: "Gemüse 150g",
        description: "Gemüse Mix",
        brand: "BILLA AT",
        grams: 150,
        kcal: 60,
        protein: 3,
        carbs: 10,
        fat: 0.5,
        source: "manual",
        source_kind: "addon",
      },
    ],
  },
  {
    id: "hauber_pizza_style_chicken_nuggets",
    kind: "recipe",
    category: "billa",
    name: "Hauber Pizza Style Chicken Nuggets",
    meal_type: "snack",
    description: "Pizza Style Chicken Nuggets",
    notes: "Template-Wert; bei Bedarf mit Packungsangaben/Produktseite feinjustieren.",
    source: "manual",
    yield_g: null,
    components: [
      {
        id: "pizza_style_chicken_nuggets",
        label: "Pizza Style Chicken Nuggets",
        description: "Pizza Style Chicken Nuggets",
        brand: "Hauber",
        grams: null,
        kcal: 360,
        protein: 20,
        carbs: 24,
        fat: 20,
        source: "hauber.at",
        source_kind: "base",
      },
    ],
  },
];

function loadNutritionCatalog() {
  const seed = {
    version: 1,
    updated_at: new Date().toISOString(),
    items: NUTRITION_CATALOG_DEFAULTS.map((item) => ({
      ...item,
      components: item.components.map((component) => ({ ...component })),
      addons: Array.isArray(item.addons) ? item.addons.map((addon) => ({ ...addon })) : [],
      default_addon_ids: Array.isArray(item.default_addon_ids) ? [...item.default_addon_ids] : [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      kcal: sumComponentMacros([
        ...item.components,
        ...((Array.isArray(item.addons) && Array.isArray(item.default_addon_ids))
          ? item.addons.filter((addon) => item.default_addon_ids.includes(addon.id))
          : []),
      ]).kcal,
      protein: sumComponentMacros([
        ...item.components,
        ...((Array.isArray(item.addons) && Array.isArray(item.default_addon_ids))
          ? item.addons.filter((addon) => item.default_addon_ids.includes(addon.id))
          : []),
      ]).protein,
      carbs: sumComponentMacros([
        ...item.components,
        ...((Array.isArray(item.addons) && Array.isArray(item.default_addon_ids))
          ? item.addons.filter((addon) => item.default_addon_ids.includes(addon.id))
          : []),
      ]).carbs,
      fat: sumComponentMacros([
        ...item.components,
        ...((Array.isArray(item.addons) && Array.isArray(item.default_addon_ids))
          ? item.addons.filter((addon) => item.default_addon_ids.includes(addon.id))
          : []),
      ]).fat,
    })),
  };

  const catalog = readJsonFile(NUTRITION_CATALOG_PATH, null);
  if (catalog && Array.isArray(catalog.items)) {
    const existingIds = new Set(catalog.items.map((item) => item.id));
    const mergedItems = [
      ...catalog.items,
      ...seed.items.filter((item) => !existingIds.has(item.id)),
    ];
    if (mergedItems.length !== catalog.items.length) {
      const mergedCatalog = { ...catalog, items: mergedItems };
      saveNutritionCatalog(mergedCatalog);
      return mergedCatalog;
    }
    return catalog;
  }
  writeJsonFile(NUTRITION_CATALOG_PATH, seed);
  return seed;
}

function saveNutritionCatalog(catalog) {
  catalog.updated_at = new Date().toISOString();
  writeJsonFile(NUTRITION_CATALOG_PATH, catalog);
}

function getSupplementsDayPath(date) {
  return path.join(SUPPLEMENTS_LOG_DIR, `${date}.json`);
}

function loadSupplementsCatalog() {
  const seed = {
    version: 1,
    updated_at: new Date().toISOString(),
    items: [
      { id: "melatonin", name: "Melatonin", unit: "mg", default_dose: 1, default_time_of_day: "night" },
      { id: "glycin", name: "Glycin", unit: "g", default_dose: 3, default_time_of_day: "night" },
      { id: "kollagen", name: "Kollagen", unit: "g", default_dose: 10, default_time_of_day: "morning" },
      { id: "magnesium", name: "Magnesium", unit: "mg", default_dose: 200, default_time_of_day: "evening" },
      { id: "vitamin_d3", name: "Vitamin D3", unit: "IU", default_dose: 2000, default_time_of_day: "morning" },
      { id: "omega3", name: "Omega-3", unit: "mg", default_dose: 1000, default_time_of_day: "morning" },
    ],
  };

  const catalog = readJsonFile(SUPPLEMENTS_CATALOG_PATH, null);
  if (catalog && Array.isArray(catalog.items)) return catalog;
  writeJsonFile(SUPPLEMENTS_CATALOG_PATH, seed);
  return seed;
}

function saveSupplementsCatalog(catalog) {
  catalog.updated_at = new Date().toISOString();
  writeJsonFile(SUPPLEMENTS_CATALOG_PATH, catalog);
}

/**
 * Zählt alle Nutrition-Logs aus allen Datums-Dateien
 */
function countAllFuelLogs(dir) {
  if (!fs.existsSync(dir)) return 0;

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  let totalLogs = 0;

  files.forEach(file => {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
      if (content.logs && Array.isArray(content.logs)) {
        totalLogs += content.logs.length;
      }
    } catch (e) {
      // Malformed files ignorieren
    }
  });

  return totalLogs;
}

function parseJSONBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try {
        if (!data) {
          resolve({});
          return;
        }
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function slugifyId(value, prefix = "meal") {
  const base = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${prefix}_${base || randomId(prefix)}`.slice(0, 80);
}

function normalizeMealComponent(input, existingIndex = 0) {
  const source = input || {};
  const description = String(source.description || source.name || "").trim();
  if (!description) return null;

  const label = String(source.label || source.name || description).trim() || description;
  return {
    id: String(source.id || slugifyId(`${description}_${existingIndex + 1}`, "cmp")).slice(0, 80),
    label,
    description,
    brand: source.brand != null ? String(source.brand) : "",
    grams: source.grams == null ? null : sanitizeMetric(source.grams),
    kcal: sanitizeMetric(source.kcal),
    protein: sanitizeMetric(source.protein),
    carbs: sanitizeMetric(source.carbs),
    fat: sanitizeMetric(source.fat),
    source: String(source.source || "manual").trim() || "manual",
    source_kind: String(source.source_kind || source.kind || "food").trim() || "food",
  };
}

function sumComponentMacros(components) {
  return (Array.isArray(components) ? components : []).reduce(
    (acc, component) => ({
      kcal: acc.kcal + sanitizeMetric(component.kcal),
      protein: acc.protein + sanitizeMetric(component.protein),
      carbs: acc.carbs + sanitizeMetric(component.carbs),
      fat: acc.fat + sanitizeMetric(component.fat),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

function resolveNutritionCatalogMeal(catalogItem, addonIds = []) {
  const components = Array.isArray(catalogItem.components) ? catalogItem.components : [];
  const addons = Array.isArray(catalogItem.addons) ? catalogItem.addons : [];
  const defaultAddonIds = Array.isArray(catalogItem.default_addon_ids) ? catalogItem.default_addon_ids : [];
  const selectedAddonIds = addonIds.length ? addonIds : defaultAddonIds;
  const selectedAddons = selectedAddonIds.length ? addons.filter((addon) => selectedAddonIds.includes(addon.id)) : [];
  const totals = sumComponentMacros([...components, ...selectedAddons]);

  return {
    meal: {
      id: randomId("meal"),
      type: String(catalogItem.meal_type || catalogItem.kind || "meal"),
      description: String(catalogItem.description || catalogItem.name),
      notes: catalogItem.notes ? String(catalogItem.notes) : "",
      kcal: totals.kcal,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      catalog_item_id: catalogItem.id,
      catalog_name: catalogItem.name,
      catalog_components: [...components, ...selectedAddons].map((component) => ({ ...component })),
      catalog_addon_ids: selectedAddonIds,
      time: new Date().toISOString(),
    },
    addons: selectedAddons,
  };
}

function normalizeNutritionCatalogItem(input, existingItems = []) {
  const source = input || {};
  const name = String(source.name || source.description || source.title || "").trim();
  if (!name) return null;

  const kind = String(source.kind || "meal").trim() || "meal";
  const category = String(source.category || (kind === "recipe" ? "recipe" : kind) || "meal").trim() || "meal";
  const description = String(source.description || name).trim();
  const notes = source.notes != null ? String(source.notes) : "";
  const mealType = String(source.meal_type || source.type || "meal").trim() || "meal";
  const idBase = source.id ? String(source.id).trim() : slugifyId(name, kind);
  const existingIds = new Set(existingItems.map((item) => item.id));
  let id = idBase;
  let suffix = 2;
  while (existingIds.has(id) && !existingItems.some((item) => item.id === source.id)) {
    id = `${idBase}_${suffix++}`;
  }

  const components = Array.isArray(source.components)
    ? source.components
        .map((component, idx) => normalizeMealComponent(component, idx))
        .filter(Boolean)
    : [];
  const addons = Array.isArray(source.addons)
    ? source.addons
        .map((addon, idx) => normalizeMealComponent({ ...addon, source_kind: addon.source_kind || "addon" }, idx))
        .filter(Boolean)
    : [];
  const defaultAddonIds = Array.isArray(source.default_addon_ids)
    ? source.default_addon_ids.map((id) => String(id).trim()).filter(Boolean)
    : [];
  const selectedAddons = defaultAddonIds.length
    ? addons.filter((addon) => defaultAddonIds.includes(addon.id))
    : addons;
  const componentTotals = sumComponentMacros([...components, ...selectedAddons]);
  const kcal = source.kcal != null && source.kcal !== "" ? sanitizeMetric(source.kcal) : (componentTotals?.kcal ?? 0);
  const protein = source.protein != null && source.protein !== "" ? sanitizeMetric(source.protein) : (componentTotals?.protein ?? 0);
  const carbs = source.carbs != null && source.carbs !== "" ? sanitizeMetric(source.carbs) : (componentTotals?.carbs ?? 0);
  const fat = source.fat != null && source.fat !== "" ? sanitizeMetric(source.fat) : (componentTotals?.fat ?? 0);

  return {
    id,
    kind,
    category,
    name,
    meal_type: mealType,
    description,
    notes,
    kcal,
    protein,
    carbs,
    fat,
    yield_g: source.yield_g == null || source.yield_g === "" ? null : sanitizeMetric(source.yield_g),
    components,
    addons,
    default_addon_ids: defaultAddonIds,
    source: String(source.source || "manual").trim() || "manual",
    created_at: source.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const routedPath = normalizeRoutedPath(url.pathname);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (routedPath === "/health") {
    sendJson(res, 200, { ok: true, port: PORT });
    return;
  }

  if (shouldProxyToVite(routedPath)) {
    proxyToVite(req, res, routedPath);
    return;
  }

  if (routedPath === "/v2" || routedPath === "/v2/") {
    const v2Index = path.join(STATIC_DIR, "index.html");
    if (STATIC_DIR !== PUBLIC_DIR && fs.existsSync(v2Index)) {
      serveFile(v2Index, res);
    } else {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(v2PreviewHtml());
    }
    return;
  }

  /**
   * POST /fuel/log
   * Loggt neue Mahlzeit/Snack
   * {datum, mahlzeit, speise, kalorien, protein, kohlenhydrate, fett, notizen}
   */
  if (req.method === "POST" && routedPath === "/fuel/log") {
    try {
      const body = await parseJSONBody(req);

      if (!body.speise || !body.mahlzeit) {
        sendJson(res, 400, { error: "speise and mahlzeit required" });
        return;
      }

      const datum = body.datum || new Date().toISOString().split('T')[0];
      const log = {
        datum,
        mahlzeit: body.mahlzeit,  // frühstück/mittagessen/abendessen/snack
        speise: body.speise,
        kalorien: body.kalorien || 0,
        protein: body.protein || 0,
        kohlenhydrate: body.kohlenhydrate || 0,
        fett: body.fett || 0,
        notizen: body.notizen || "",
        time: new Date().toISOString()
      };

      const fileName = `${datum}.json`;
      const filePath = path.join(FUEL_DIR, fileName);

      let dayData = { date: datum, logs: [] };
      if (fs.existsSync(filePath)) {
        try {
          dayData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (e) {
          dayData = { date: datum, logs: [] };
        }
      }

      dayData.logs.push(log);
      fs.writeFileSync(filePath, JSON.stringify(dayData, null, 2));

      const totalLogs = countAllFuelLogs(FUEL_DIR);

      sendJson(res, 200, {
        ok: true,
        log_nr: totalLogs,
        total: totalLogs
      });
    } catch (error) {
      console.error("Error processing log:", error);
      sendJson(res, 500, { error: "Internal server error" });
    }
    return;
  }

  /**
   * GET /fuel/progress
   * Gibt alle Logs chronologisch sortiert zurück
   */
  if (req.method === "GET" && routedPath === "/fuel/progress") {
    try {
      const files = fs.existsSync(FUEL_DIR)
        ? fs.readdirSync(FUEL_DIR).filter(f => f.endsWith('.json'))
        : [];

      const logs = [];
      files.forEach(file => {
        try {
          const content = JSON.parse(fs.readFileSync(path.join(FUEL_DIR, file), 'utf-8'));
          if (content.logs && Array.isArray(content.logs)) {
            logs.push(...content.logs);
          }
        } catch (e) {
          // Ignore
        }
      });

      logs.sort((a, b) => new Date(a.time) - new Date(b.time));

      const logsWithNr = logs.map((l, idx) => ({
        ...l,
        log_nr: idx + 1
      }));

      // Berechne Makro-Summen
      const totalKalorien = logs.reduce((sum, l) => sum + (l.kalorien || 0), 0);
      const totalProtein = logs.reduce((sum, l) => sum + (l.protein || 0), 0);
      const totalKohlenhydrate = logs.reduce((sum, l) => sum + (l.kohlenhydrate || 0), 0);
      const totalFett = logs.reduce((sum, l) => sum + (l.fett || 0), 0);

      sendJson(res, 200, {
        total: logs.length,
        macros: {
          kalorien: totalKalorien,
          protein: totalProtein,
          kohlenhydrate: totalKohlenhydrate,
          fett: totalFett
        },
        logs: logsWithNr
      });
    } catch (error) {
      console.error("Error getting progress:", error);
      sendJson(res, 500, { error: "Internal server error" });
    }
    return;
  }

  /**
   * GET /nutrition/log?date=YYYY-MM-DD
   */
  if (req.method === "GET" && routedPath === "/nutrition/log") {
    const date = url.searchParams.get("date") || todayISO();
    if (!isISODate(date)) {
      sendJson(res, 400, { error: "invalid date" });
      return;
    }
    const filePath = getNutritionDayPath(date);
    const day = readJsonFile(filePath, { date, meals: [], water_ml: 0 });
    sendJson(res, 200, { ok: true, data: day });
    return;
  }

  /**
   * POST /nutrition/log
   * Body: {date, meal?: {type, description, notes?}, water_ml?: number}
   */
  if (req.method === "POST" && routedPath === "/nutrition/log") {
    try {
      const body = await parseJSONBody(req);
      const date = body.date || todayISO();
      if (!isISODate(date)) {
        sendJson(res, 400, { error: "invalid date" });
        return;
      }

      const filePath = getNutritionDayPath(date);
      const day = readJsonFile(filePath, { date, meals: [], water_ml: 0 });
      if (!day.meals || !Array.isArray(day.meals)) day.meals = [];
      if (typeof day.water_ml !== "number") day.water_ml = 0;

      if (body.delete_meal_id) {
        day.meals = day.meals.filter((m) => m.id !== body.delete_meal_id);
      }

      if (body.catalog_item_id) {
        const catalog = loadNutritionCatalog();
        const items = Array.isArray(catalog.items) ? catalog.items : [];
        const catalogItem = items.find((item) => item.id === body.catalog_item_id);
        if (!catalogItem) {
          sendJson(res, 404, { error: "catalog item not found" });
          return;
        }
        const addonIds = Array.isArray(body.catalog_addon_ids)
          ? body.catalog_addon_ids.map((id) => String(id).trim()).filter(Boolean)
          : [];
        const { meal } = resolveNutritionCatalogMeal(catalogItem, addonIds);
        day.meals.push(meal);
      }

      if (body.update_meal) {
        const { id, type, description, notes, kcal, protein, carbs, fat } = body.update_meal;
        const idx = day.meals.findIndex((m) => m.id === id);
        if (idx === -1) { sendJson(res, 404, { error: "meal not found" }); return; }
        day.meals[idx] = {
          ...day.meals[idx],
          type: String(type || day.meals[idx].type),
          description: String(description || day.meals[idx].description),
          notes: notes != null ? String(notes) : day.meals[idx].notes,
          kcal: sanitizeMetric(kcal ?? day.meals[idx].kcal),
          protein: sanitizeMetric(protein ?? day.meals[idx].protein),
          carbs: sanitizeMetric(carbs ?? day.meals[idx].carbs),
          fat: sanitizeMetric(fat ?? day.meals[idx].fat),
        };
      }

      if (body.meal) {
        const { type, description, notes } = body.meal || {};
        if (!type || !description) {
          sendJson(res, 400, { error: "meal.type and meal.description required" });
          return;
        }
        const meal = {
          id: randomId("meal"),
          type: String(type),
          description: String(description),
          notes: notes ? String(notes) : "",
          kcal: sanitizeMetric(body.meal.kcal),
          protein: sanitizeMetric(body.meal.protein),
          carbs: sanitizeMetric(body.meal.carbs),
          fat: sanitizeMetric(body.meal.fat),
          catalog_item_id: body.meal.catalog_item_id || null,
          catalog_components: Array.isArray(body.meal.catalog_components) ? body.meal.catalog_components : [],
          time: new Date().toISOString(),
        };
        day.meals.push(meal);
      }

      if (body.water_ml != null) {
        const ml = Number(body.water_ml);
        if (!Number.isFinite(ml) || ml < 0) {
          sendJson(res, 400, { error: "invalid water_ml" });
          return;
        }
        day.water_ml = Math.round(ml);
      }

      writeJsonFile(filePath, day);
      sendJson(res, 200, { ok: true, data: day });
    } catch (error) {
      console.error("Error processing nutrition log:", error);
      sendJson(res, 500, { error: "Internal server error" });
    }
    return;
  }

  /**
   * GET /nutrition/catalog
   */
  if (req.method === "GET" && routedPath === "/nutrition/catalog") {
    const catalog = loadNutritionCatalog();
    sendJson(res, 200, { ok: true, items: catalog.items || [] });
    return;
  }

  /**
   * POST /nutrition/catalog
   * Body: {item:{name, description?, type?, notes?, kcal, protein, carbs, fat}}
   */
  if (req.method === "POST" && routedPath === "/nutrition/catalog") {
    try {
      const body = await parseJSONBody(req);
      const catalog = loadNutritionCatalog();
      const items = Array.isArray(catalog.items) ? catalog.items : [];
      const rawItem = body.item || body.meal || body.template || body;
      const item = normalizeNutritionCatalogItem(rawItem, items);

      if (!item) {
        sendJson(res, 400, { error: "item.name or item.description required" });
        return;
      }

      const idx = items.findIndex((existing) => existing.id === item.id);
      if (idx >= 0) {
        item.created_at = items[idx].created_at || item.created_at;
        items[idx] = { ...items[idx], ...item };
      } else {
        items.push(item);
      }

      catalog.items = items;
      saveNutritionCatalog(catalog);
      sendJson(res, 200, { ok: true, item });
    } catch (error) {
      console.error("Error saving nutrition catalog item:", error);
      sendJson(res, 500, { error: "Internal server error" });
    }
    return;
  }

  /**
   * GET /nutrition/journal?date=YYYY-MM-DD
   */
  if (req.method === "GET" && routedPath === "/nutrition/journal") {
    const date = url.searchParams.get("date") || todayISO();
    if (!isISODate(date)) {
      sendJson(res, 400, { error: "invalid date" });
      return;
    }
    const filePath = path.join(NUTRITION_JOURNAL_DIR, `${date}.md`);
    const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
    sendJson(res, 200, { ok: true, date, content });
    return;
  }

  /**
   * POST /nutrition/journal
   * Body: {date, content}
   */
  if (req.method === "POST" && routedPath === "/nutrition/journal") {
    try {
      const body = await parseJSONBody(req);
      const date = body.date || todayISO();
      if (!isISODate(date)) {
        sendJson(res, 400, { error: "invalid date" });
        return;
      }
      const content = body.content == null ? "" : String(body.content);
      const filePath = path.join(NUTRITION_JOURNAL_DIR, `${date}.md`);
      fs.writeFileSync(filePath, content);
      sendJson(res, 200, { ok: true, date });
    } catch (error) {
      console.error("Error saving journal:", error);
      sendJson(res, 500, { error: "Internal server error" });
    }
    return;
  }

  /**
   * GET /nutrition/journal/list
   */
  if (req.method === "GET" && routedPath === "/nutrition/journal/list") {
    const files = fs.existsSync(NUTRITION_JOURNAL_DIR)
      ? fs.readdirSync(NUTRITION_JOURNAL_DIR).filter((f) => f.endsWith(".md"))
      : [];
    files.sort().reverse();
    const entries = files.map((name) => ({ name, date: name.replace(/\.md$/, "") }));
    sendJson(res, 200, { ok: true, entries });
    return;
  }

  /**
   * GET /supplements/catalog
   */
  if (req.method === "GET" && routedPath === "/supplements/catalog") {
    const catalog = loadSupplementsCatalog();
    sendJson(res, 200, { ok: true, items: catalog.items || [] });
    return;
  }

  /**
   * POST /supplements/catalog
   * Body: {name, unit?, default_dose?, default_time_of_day?}
   */
  if (req.method === "POST" && routedPath === "/supplements/catalog") {
    try {
      const body = await parseJSONBody(req);
      const name = (body.name || "").toString().trim();
      if (!name) {
        sendJson(res, 400, { error: "name required" });
        return;
      }

      const unit = (body.unit || "mg").toString().trim() || "mg";
      const defaultDose = body.default_dose == null ? null : Number(body.default_dose);
      const defaultTime = (body.default_time_of_day || "any").toString().trim() || "any";

      const catalog = loadSupplementsCatalog();
      const idBase = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40) || "supplement";
      let id = idBase;
      const existingIds = new Set((catalog.items || []).map((i) => i.id));
      let n = 2;
      while (existingIds.has(id)) {
        id = `${idBase}_${n++}`;
      }

      const item = {
        id,
        name,
        unit,
        default_dose: Number.isFinite(defaultDose) ? defaultDose : null,
        default_time_of_day: defaultTime,
      };

      catalog.items = Array.isArray(catalog.items) ? catalog.items : [];
      catalog.items.push(item);
      saveSupplementsCatalog(catalog);
      sendJson(res, 200, { ok: true, item });
    } catch (error) {
      console.error("Error creating supplement:", error);
      sendJson(res, 500, { error: "Internal server error" });
    }
    return;
  }

  /**
   * GET /supplements/log?date=YYYY-MM-DD
   */
  if (req.method === "GET" && routedPath === "/supplements/log") {
    const date = url.searchParams.get("date") || todayISO();
    if (!isISODate(date)) {
      sendJson(res, 400, { error: "invalid date" });
      return;
    }
    const filePath = getSupplementsDayPath(date);
    const day = readJsonFile(filePath, { date, intakes: [] });
    sendJson(res, 200, { ok: true, data: day });
    return;
  }

  /**
   * POST /supplements/log
   * Body: {date, intake?: {supplement_id, dose?, unit?, time_of_day?, notes?}, delete_id?: string}
   */
  if (req.method === "POST" && routedPath === "/supplements/log") {
    try {
      const body = await parseJSONBody(req);
      const date = body.date || todayISO();
      if (!isISODate(date)) {
        sendJson(res, 400, { error: "invalid date" });
        return;
      }

      const filePath = getSupplementsDayPath(date);
      const day = readJsonFile(filePath, { date, intakes: [] });
      if (!day.intakes || !Array.isArray(day.intakes)) day.intakes = [];

      if (body.delete_id) {
        const before = day.intakes.length;
        day.intakes = day.intakes.filter((i) => i.id !== body.delete_id);
        writeJsonFile(filePath, day);
        sendJson(res, 200, { ok: true, removed: before - day.intakes.length, data: day });
        return;
      }

      if (!body.intake) {
        sendJson(res, 400, { error: "intake or delete_id required" });
        return;
      }

      const catalog = loadSupplementsCatalog();
      const items = Array.isArray(catalog.items) ? catalog.items : [];
      const supplementId = (body.intake.supplement_id || "").toString().trim();
      const supplement = items.find((i) => i.id === supplementId);
      if (!supplement) {
        sendJson(res, 400, { error: "unknown supplement_id" });
        return;
      }

      const dose = body.intake.dose == null ? null : Number(body.intake.dose);
      const unit = (body.intake.unit || supplement.unit || "mg").toString().trim() || "mg";
      const timeOfDay = (body.intake.time_of_day || supplement.default_time_of_day || "any").toString().trim() || "any";
      const notes = body.intake.notes ? String(body.intake.notes) : "";

      const intake = {
        id: randomId("supp"),
        supplement_id: supplement.id,
        name: supplement.name,
        dose: Number.isFinite(dose) ? dose : null,
        unit,
        time_of_day: timeOfDay,
        notes,
        time: new Date().toISOString(),
      };
      day.intakes.push(intake);
      writeJsonFile(filePath, day);
      sendJson(res, 200, { ok: true, data: day });
    } catch (error) {
      console.error("Error processing supplement log:", error);
      sendJson(res, 500, { error: "Internal server error" });
    }
    return;
  }

  /**
   * GET /supplements/stats?days=30&anchor=YYYY-MM-DD
   */
  if (req.method === "GET" && routedPath === "/supplements/stats") {
    const daysRaw = url.searchParams.get("days") || "30";
    const days = Math.min(365, Math.max(1, Number(daysRaw) || 30));
    const anchor = url.searchParams.get("anchor") || todayISO();
    if (!isISODate(anchor)) {
      sendJson(res, 400, { error: "invalid anchor" });
      return;
    }

    const catalog = loadSupplementsCatalog();
    const items = Array.isArray(catalog.items) ? catalog.items : [];
    const bySupplement = new Map(items.map((i) => [i.id, { supplement: i, days_taken: 0, current_streak: 0 }]));

    const dates = [];
    const anchorDate = new Date(`${anchor}T00:00:00Z`);
    for (let i = 0; i < days; i++) {
      const d = new Date(anchorDate);
      d.setUTCDate(anchorDate.getUTCDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const tookOnDate = new Map(); // date -> Set(supplement_id)
    for (const date of dates) {
      const day = readJsonFile(getSupplementsDayPath(date), null);
      if (!day || !Array.isArray(day.intakes) || day.intakes.length === 0) continue;
      const set = new Set(day.intakes.map((x) => x.supplement_id).filter(Boolean));
      if (set.size) tookOnDate.set(date, set);
      for (const id of set) {
        const row = bySupplement.get(id);
        if (row) row.days_taken += 1;
      }
    }

    // current streak: count consecutive days from anchor backwards where taken
    for (const [id, row] of bySupplement.entries()) {
      let streak = 0;
      for (const date of dates) {
        const set = tookOnDate.get(date);
        if (set && set.has(id)) streak += 1;
        else break;
      }
      row.current_streak = streak;
    }

    const stats = Array.from(bySupplement.values()).map((r) => ({
      supplement: r.supplement,
      days_taken: r.days_taken,
      current_streak: r.current_streak,
    }));

    // Sort by days_taken desc
    stats.sort((a, b) => (b.days_taken - a.days_taken) || a.supplement.name.localeCompare(b.supplement.name));
    sendJson(res, 200, { ok: true, anchor, days, stats });
    return;
  }

  /**
   * GET /nutrition/search?q=<query>&limit=<n>
   * Hybrid: wger (lokal, :8000) zuerst → OFF als Fallback
   * Rückgabe: {name, brand, kcal, kh, fett, ew} pro 100g
   */
  if (req.method === "GET" && routedPath === "/nutrition/search") {
    const q = url.searchParams.get("q") || "";
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 20)));
    if (!q.trim()) {
      sendJson(res, 400, { error: "q required" });
      return;
    }

    const WGER_TOKEN = process.env.WGER_API_TOKEN || "92d9ea44fc0ac065e336e9ec443a196c40c68afe";
    const WGER_MIN = 3; // Mindest-Ergebnisse aus wger, sonst OFF-Fallback

    function fetchWger(query, n) {
      return new Promise((resolve) => {
        const wgerUrl = `http://127.0.0.1:8000/api/v2/ingredient/?format=json&limit=${n}&name__search=${encodeURIComponent(query)}`;
        const wgerReq = http.get(wgerUrl, { headers: { "Authorization": `Token ${WGER_TOKEN}` } }, (r) => {
          let raw = "";
          r.on("data", (c) => (raw += c));
          r.on("end", () => {
            try {
              const data = JSON.parse(raw);
              const results = (data.results || [])
                .filter((i) => i.name && i.energy != null)
                .map((i) => ({
                  name:  i.name.trim(),
                  brand: i.brand || "",
                  kcal:  Math.round((i.energy ?? 0) * 10) / 10,
                  kh:    Math.round((parseFloat(i.carbohydrates) ?? 0) * 10) / 10,
                  fett:  Math.round((parseFloat(i.fat) ?? 0) * 10) / 10,
                  ew:    Math.round((parseFloat(i.protein) ?? 0) * 10) / 10,
                  _src:  "wger",
                }));
              resolve(results);
            } catch { resolve([]); }
          });
        });
        wgerReq.on("error", () => resolve([]));
        wgerReq.setTimeout(3000, () => { wgerReq.destroy(); resolve([]); });
      });
    }

    function fetchOFF(query, n) {
      return new Promise((resolve) => {
        const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=${n}`;
        const offReq = https.get(offUrl, { headers: { "User-Agent": "fuel-dev/2.0 (nutrition search)" } }, (r) => {
          let raw = "";
          r.on("data", (c) => (raw += c));
          r.on("end", () => {
            try {
              const data = JSON.parse(raw);
              const results = (data.products || [])
                .filter((p) => p.product_name && p.nutriments?.["energy-kcal_100g"] != null)
                .map((p) => ({
                  name:  p.product_name,
                  brand: p.brands || "",
                  kcal:  Math.round((p.nutriments["energy-kcal_100g"] ?? 0) * 10) / 10,
                  kh:    Math.round((p.nutriments.carbohydrates_100g ?? 0) * 10) / 10,
                  fett:  Math.round((p.nutriments.fat_100g ?? 0) * 10) / 10,
                  ew:    Math.round((p.nutriments.proteins_100g ?? 0) * 10) / 10,
                  _src:  "off",
                }));
              resolve(results);
            } catch { resolve([]); }
          });
        });
        offReq.on("error", () => resolve([]));
        offReq.setTimeout(8000, () => { offReq.destroy(); resolve([]); });
      });
    }

    const wgerResults = await fetchWger(q, limit);
    let results = wgerResults;

    if (wgerResults.length < WGER_MIN) {
      const offResults = await fetchOFF(q, limit);
      const seen = new Set(wgerResults.map((r) => r.name.toLowerCase()));
      const merged = [...wgerResults, ...offResults.filter((r) => !seen.has(r.name.toLowerCase()))];
      results = merged.slice(0, limit);
    }

    sendJson(res, 200, { ok: true, count: results.length, results });
    return;
  }

  // ---- Static files (supports being mounted under a prefix) ----
  let cleanPath = routedPath === "/" ? "/index.html" : routedPath;
  if (STATIC_DIR !== PUBLIC_DIR && cleanPath.startsWith("/v2/")) {
    cleanPath = cleanPath.slice(3);
  }
  let filePath = path.join(STATIC_DIR, cleanPath);

  if (!path.resolve(filePath).startsWith(path.resolve(STATIC_DIR))) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  serveFile(filePath, res);
});

server.listen(PORT, HOST, () => {
  console.log(`🍽️  Fuel Centre running on http://${HOST}:${PORT}`);
});
