import { z } from "zod";
import { loadCatalog, saveCatalog, addOrUpdateItem } from "../services/nutrition-catalog.mjs";
import { readEntry, writeEntry, listEntries } from "../services/nutrition-journal.mjs";
import { searchNutrition } from "../services/nutrition-search.mjs";
import { composeMeal } from "../services/nutrition-compose.mjs";
import { upsertIngredient, createMeal, getMeal } from "../services/nutrition-db.mjs";
import { estimateMicros } from "../services/nutrition-estimate-micros.mjs";
import { loadMicrosCatalog, saveMicrosCatalog, addOrUpdateMicroItem } from "../services/nutrition-micros.mjs";
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
  meal_id: z.coerce.number().optional(), // Link to SQLite meal for micronutrient tracking
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
          meal_id: parsed.data.meal_id || null, // Link to SQLite meal if from Gemini-compose
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

  // POST /nutrition/estimate — Gemini-powered macro estimation
  app.post("/nutrition/estimate", async (req, reply) => {
    try {
      const { description } = req.body || {};
      if (!description || typeof description !== "string" || description.trim().length === 0) {
        return reply.status(400).send({ ok: false, error: "description required" });
      }

      const { estimateMacros } = await import("../services/nutrition-estimate.mjs");
      const macros = await estimateMacros(description);
      return reply.send({ ok: true, description, macros });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ ok: false, error: "Internal server error" });
    }
  });

  // POST /nutrition/compose — Compose meal from wger + Gemini (saves to catalog)
  app.post("/nutrition/compose", async (req, reply) => {
    try {
      const { description, save_catalog } = req.body || {};
      if (!description || typeof description !== "string" || description.trim().length === 0) {
        return reply.status(400).send({ ok: false, error: "description required" });
      }

      const composed = await composeMeal(description);

      // Save to catalog if requested
      if (save_catalog && composed.kcal > 0) {
        const catalog = loadCatalog();
        const catalogItem = {
          name: description,
          description: description,
          kcal: composed.kcal,
          protein: composed.protein,
          carbs: composed.carbs,
          fat: composed.fat,
          components: composed.components,
        };
        addOrUpdateItem(catalog, catalogItem);
        saveCatalog(catalog);

        // Also save to SQLite for micronutrient tracking
        for (const comp of composed.components || []) {
          upsertIngredient(comp.wger_id, {
            name: comp.name,
            brand: comp.brand,
            kcal: comp.kcal / (comp.quantity_g / 100),
            protein: comp.protein / (comp.quantity_g / 100),
            carbs: comp.carbs / (comp.quantity_g / 100),
            fat: comp.fat / (comp.quantity_g / 100),
            sodium_mg: comp.sodium_mg ? comp.sodium_mg / (comp.quantity_g / 100) : 0,
          });
        }

        const mealId = createMeal(description, description, composed.components);

        // Estimate and save micronutrients
        const micros = await estimateMicros(description);
        if (Object.keys(micros).length > 0) {
          const microsCatalog = loadMicrosCatalog();
          addOrUpdateMicroItem(microsCatalog, catalogItem, micros);
          saveMicrosCatalog(microsCatalog);
        }

        return reply.send({ ok: true, description, ...composed, saved: true, meal_id: mealId, micros });
      }

      return reply.send({ ok: true, description, ...composed, saved: false });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ ok: false, error: "Internal server error" });
    }
  });

  // GET /nutrition/meal/:id — Get meal with micronutrient data
  app.get("/nutrition/meal/:id", async (req, reply) => {
    try {
      const { id } = req.params;
      const mealId = parseInt(id);
      if (!mealId) {
        return reply.status(400).send({ ok: false, error: "id required" });
      }

      const meal = getMeal(mealId);
      if (!meal) {
        return reply.status(404).send({ ok: false, error: "meal not found" });
      }

      return reply.send({ ok: true, meal });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ ok: false, error: "Internal server error" });
    }
  });

  // GET /nutrition/daily/:date — Get daily totals (macros + micros) from logged meals
  app.get("/nutrition/daily/:date", async (req, reply) => {
    try {
      const { date } = req.params;
      if (!isISODate(date)) {
        return reply.status(400).send({ ok: false, error: "Invalid date format" });
      }

      const log = loadLog(date);

      // Aggregate macros + micros from logged meals
      const totals = {
        date,
        macros: {
          kcal: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
        },
        micros: {
          sodium_mg: 0,
          potassium_mg: 0,
          calcium_mg: 0,
          iron_mg: 0,
          magnesium_mg: 0,
          zinc_mg: 0,
          vitamin_a_ug: 0,
          vitamin_b12_ug: 0,
          vitamin_d_ug: 0,
          vitamin_e_mg: 0,
          folate_ug: 0,
        },
        water_ml: log.water_ml || 0,
      };

      // For each meal logged, aggregate macros + micros
      const microsCatalog = loadMicrosCatalog();
      for (const meal of log.meals || []) {
        totals.macros.kcal += meal.kcal || 0;
        totals.macros.protein += meal.protein || 0;
        totals.macros.carbs += meal.carbs || 0;
        totals.macros.fat += meal.fat || 0;

        // Try to find micros in Micros Catalog
        const microItem = microsCatalog.items.find(
          (item) => item.name === meal.description
        );
        if (microItem) {
          totals.micros.sodium_mg += microItem.sodium_mg || 0;
          totals.micros.potassium_mg += microItem.potassium_mg || 0;
          totals.micros.calcium_mg += microItem.calcium_mg || 0;
          totals.micros.iron_mg += microItem.iron_mg || 0;
          totals.micros.magnesium_mg += microItem.magnesium_mg || 0;
          totals.micros.zinc_mg += microItem.zinc_mg || 0;
          totals.micros.vitamin_a_ug += microItem.vitamin_a_ug || 0;
          totals.micros.vitamin_b12_ug += microItem.vitamin_b12_ug || 0;
          totals.micros.vitamin_d_ug += microItem.vitamin_d_ug || 0;
          totals.micros.vitamin_e_mg += microItem.vitamin_e_mg || 0;
          totals.micros.folate_ug += microItem.folate_ug || 0;
        }

        // Fallback: If meal has meal_id, fetch micronutrient data from SQLite
        if (meal.meal_id) {
          const dbMeal = getMeal(meal.meal_id);
          if (dbMeal && dbMeal.components) {
            // Aggregate sodium from components (only available from wger currently)
            if (!microItem) {
              for (const comp of dbMeal.components) {
                totals.micros.sodium_mg += comp.sodium_mg || 0;
              }
            }
          }
        }
      }

      return reply.send({ ok: true, ...totals });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ ok: false, error: "Internal server error" });
    }
  });
}
