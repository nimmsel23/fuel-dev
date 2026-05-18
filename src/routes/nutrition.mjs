import { z } from "zod";
import { loadCatalog, saveCatalog, addOrUpdateItem } from "../services/nutrition-catalog.mjs";
import { readEntry, writeEntry, listEntries } from "../services/nutrition-journal.mjs";
import { searchNutrition } from "../services/nutrition-search.mjs";
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
    const results = await searchNutrition(q, limit);
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
