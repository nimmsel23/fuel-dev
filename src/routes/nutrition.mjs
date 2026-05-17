import http from "http";
import https from "https";
import { z } from "zod";
import { WGER_API_URL, WGER_API_TOKEN, WGER_MIN_RESULTS, OFF_API_URL } from "../config/constants.mjs";
import { loadCatalog, saveCatalog, addOrUpdateItem } from "../services/nutrition-catalog.mjs";
import { readEntry, writeEntry, listEntries } from "../services/nutrition-journal.mjs";
import { isISODate, todayISO } from "../lib/validation.mjs";
import path from "path";
import fs from "fs";
import { NUTRITION_DIR } from "../config/paths.mjs";

const searchQuerySchema = z.object({
  q: z.string().min(1, "q required"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const logPostSchema = z.object({
  date: z.string().optional(),
  meal: z.object({
    type: z.string().optional(),
    description: z.string().min(1),
    notes: z.string().optional(),
    kcal: z.coerce.number().min(0).optional(),
    protein: z.coerce.number().min(0).optional(),
    carbs: z.coerce.number().min(0).optional(),
    fat: z.coerce.number().min(0).optional(),
  }).optional(),
  update_meal: z.any().optional(),
  delete_meal_id: z.string().optional(),
  water_ml: z.coerce.number().optional(),
});

const catalogPostSchema = z.object({
  item: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    kcal: z.coerce.number().optional(),
    protein: z.coerce.number().optional(),
    carbs: z.coerce.number().optional(),
    fat: z.coerce.number().optional(),
  }).optional(),
});

const journalSchema = z.object({
  date: z.string().optional(),
  content: z.string().optional(),
});

async function searchWger(query, limit) {
  return new Promise((resolve) => {
    const url = `${WGER_API_URL}/ingredient/?format=json&limit=${limit}&name__search=${encodeURIComponent(query)}`;
    const req = http.get(url, { headers: { "Authorization": `Token ${WGER_API_TOKEN}` } }, (r) => {
      let raw = "";
      r.on("data", (c) => (raw += c));
      r.on("end", () => {
        try {
          const data = JSON.parse(raw);
          const results = (data.results || [])
            .filter((i) => i.name && i.energy != null)
            .map((i) => ({
              name: i.name.trim(),
              brand: i.brand || "",
              kcal: Math.round((i.energy ?? 0) * 10) / 10,
              kh: Math.round((parseFloat(i.carbohydrates) ?? 0) * 10) / 10,
              fett: Math.round((parseFloat(i.fat) ?? 0) * 10) / 10,
              ew: Math.round((parseFloat(i.protein) ?? 0) * 10) / 10,
              _src: "wger",
            }));
          resolve(results);
        } catch {
          resolve([]);
        }
      });
    });
    req.on("error", () => resolve([]));
    req.setTimeout(3000, () => { req.destroy(); resolve([]); });
  });
}

async function searchOFF(query, limit) {
  return new Promise((resolve) => {
    const url = `${OFF_API_URL}?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=${limit}`;
    const req = https.get(url, { headers: { "User-Agent": "fuel-dev/2.0" } }, (r) => {
      let raw = "";
      r.on("data", (c) => (raw += c));
      r.on("end", () => {
        try {
          const data = JSON.parse(raw);
          const results = (data.products || [])
            .filter((p) => p.product_name && p.nutriments?.["energy-kcal_100g"] != null)
            .map((p) => ({
              name: p.product_name,
              brand: p.brands || "",
              kcal: Math.round((p.nutriments["energy-kcal_100g"] ?? 0) * 10) / 10,
              kh: Math.round((p.nutriments.carbohydrates_100g ?? 0) * 10) / 10,
              fett: Math.round((p.nutriments.fat_100g ?? 0) * 10) / 10,
              ew: Math.round((p.nutriments.proteins_100g ?? 0) * 10) / 10,
              _src: "off",
            }));
          resolve(results);
        } catch {
          resolve([]);
        }
      });
    });
    req.on("error", () => resolve([]));
    req.setTimeout(8000, () => { req.destroy(); resolve([]); });
  });
}

function loadLog(date) {
  const filePath = path.join(NUTRITION_DIR, `${date}.json`);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      return { date, meals: [], water_ml: 0 };
    }
  }
  return { date, meals: [], water_ml: 0 };
}

function saveLog(log) {
  const filePath = path.join(NUTRITION_DIR, `${log.date}.json`);
  fs.writeFileSync(filePath, JSON.stringify(log, null, 2), "utf-8");
}

export default async function nutritionRoute(app) {
  // GET /nutrition/search
  app.get("/nutrition/search", async (req, reply) => {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: "Invalid query" });
    }
    const { q, limit } = parsed.data;
    const wgerResults = await searchWger(q, limit);
    let results = wgerResults;
    if (wgerResults.length < WGER_MIN_RESULTS) {
      const offResults = await searchOFF(q, limit);
      const seen = new Set(wgerResults.map((r) => r.name.toLowerCase()));
      const merged = [...wgerResults, ...offResults.filter((r) => !seen.has(r.name.toLowerCase()))];
      results = merged.slice(0, limit);
    }
    return reply.send({ ok: true, count: results.length, results });
  });

  // GET /nutrition/log
  app.get("/nutrition/log", async (req, reply) => {
    const date = (req.query.date || todayISO()).toString();
    if (!isISODate(date)) {
      return reply.status(400).send({ ok: false, error: "Invalid date" });
    }
    const log = loadLog(date);
    return reply.send({ ok: true, data: log });
  });

  // POST /nutrition/log
  app.post("/nutrition/log", async (req, reply) => {
    try {
      const parsed = logPostSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return reply.status(400).send({ ok: false, error: "Invalid data" });
      }
      const date = (parsed.data.date || todayISO()).toString();
      if (!isISODate(date)) {
        return reply.status(400).send({ ok: false, error: "Invalid date" });
      }
      const log = loadLog(date);
      if (parsed.data.meal) {
        log.meals.push({
          id: `meal_${Date.now()}`,
          type: parsed.data.meal.type || "meal",
          description: parsed.data.meal.description,
          notes: parsed.data.meal.notes || "",
          kcal: parsed.data.meal.kcal || 0,
          protein: parsed.data.meal.protein || 0,
          carbs: parsed.data.meal.carbs || 0,
          fat: parsed.data.meal.fat || 0,
          time: new Date().toISOString(),
        });
      }
      if (parsed.data.delete_meal_id) {
        log.meals = log.meals.filter((m) => m.id !== parsed.data.delete_meal_id);
      }
      if (parsed.data.water_ml !== undefined) {
        log.water_ml = parsed.data.water_ml;
      }
      saveLog(log);
      return reply.send({ ok: true, data: log });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ ok: false, error: "Internal server error" });
    }
  });

  // GET /nutrition/catalog
  app.get("/nutrition/catalog", async (req, reply) => {
    const catalog = loadCatalog();
    return reply.send({ ok: true, items: catalog.items || [] });
  });

  // POST /nutrition/catalog
  app.post("/nutrition/catalog", async (req, reply) => {
    try {
      const parsed = catalogPostSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return reply.status(400).send({ ok: false, error: "Invalid data" });
      }
      const catalog = loadCatalog();
      const item = addOrUpdateItem(catalog, parsed.data.item || {});
      if (!item) {
        return reply.status(400).send({ ok: false, error: "Name required" });
      }
      saveCatalog(catalog);
      return reply.send({ ok: true, item });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ ok: false, error: "Internal server error" });
    }
  });

  // GET /nutrition/journal
  app.get("/nutrition/journal", async (req, reply) => {
    const date = (req.query.date || todayISO()).toString();
    if (!isISODate(date)) {
      return reply.status(400).send({ ok: false, error: "Invalid date" });
    }
    const content = readEntry(date);
    return reply.send({ ok: true, date, content });
  });

  // POST /nutrition/journal
  app.post("/nutrition/journal", async (req, reply) => {
    try {
      const parsed = journalSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return reply.status(400).send({ ok: false, error: "Invalid data" });
      }
      const date = (parsed.data.date || todayISO()).toString();
      if (!isISODate(date)) {
        return reply.status(400).send({ ok: false, error: "Invalid date" });
      }
      writeEntry(date, parsed.data.content || "");
      return reply.send({ ok: true, date });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ ok: false, error: "Internal server error" });
    }
  });

  // GET /nutrition/journal/list
  app.get("/nutrition/journal/list", async (req, reply) => {
    const entries = listEntries();
    return reply.send({ ok: true, entries });
  });
}
