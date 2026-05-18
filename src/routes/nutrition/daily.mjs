import { z } from "zod";
import { searchNutrition } from "../../services/nutrition-search.mjs";
import { isISODate } from "../../lib/validation.mjs";
import { loadMicrosCatalog, getMicrosForComponents, zeroMicros } from "../../services/nutrition-micros.mjs";
import path from "path";
import fs from "fs";
import { NUTRITION_DIR, NUTRITION_CATALOG_PATH } from "../../config/paths.mjs";

const searchQuerySchema = z.object({
  q: z.string().min(1, "q required"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

function loadLog(date) {
  const filePath = path.join(NUTRITION_DIR, `${date}.json`);
  if (fs.existsSync(filePath)) {
    try { return JSON.parse(fs.readFileSync(filePath, "utf-8")); } catch { /* fall through */ }
  }
  return { date, meals: [], water_ml: 0 };
}

function loadMealCatalog() {
  if (fs.existsSync(NUTRITION_CATALOG_PATH)) {
    try { return JSON.parse(fs.readFileSync(NUTRITION_CATALOG_PATH, "utf-8")); } catch { /* fall through */ }
  }
  return { items: [] };
}

function getEffectiveComponents(catalogItem) {
  const components = [...(catalogItem.components || [])];
  const defaultAddonIds = new Set(catalogItem.default_addon_ids || []);
  for (const addon of catalogItem.addons || []) {
    if (defaultAddonIds.has(addon.id)) components.push(addon);
  }
  return components;
}

export default async function dailyRoute(app) {
  app.get("/nutrition/search", async (req, reply) => {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: "Invalid query" });
    }
    const results = await searchNutrition(parsed.data.q, parsed.data.limit);
    return reply.send({ ok: true, count: results.length, results });
  });

  app.get("/nutrition/daily/:date", async (req, reply) => {
    try {
      const { date } = req.params;
      if (!isISODate(date)) {
        return reply.status(400).send({ ok: false, error: "Invalid date format" });
      }

      const log = loadLog(date);
      const microsCatalog = loadMicrosCatalog();
      const mealCatalog = loadMealCatalog();

      const macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
      const micros = zeroMicros();

      for (const meal of log.meals || []) {
        macros.kcal += meal.kcal || 0;
        macros.protein += meal.protein || 0;
        macros.carbs += meal.carbs || 0;
        macros.fat += meal.fat || 0;

        const catalogEntry = mealCatalog.items.find(
          (i) => (meal.catalog_id && i.id === meal.catalog_id) ||
                  i.name === meal.description ||
                  i.description === meal.description
        );

        if (catalogEntry) {
          const components = getEffectiveComponents(catalogEntry);
          const { micros: mealMicros } = getMicrosForComponents(components, microsCatalog);
          for (const k of Object.keys(micros)) {
            micros[k] = Math.round((micros[k] + (mealMicros[k] || 0)) * 10) / 10;
          }
        }
      }

      return reply.send({ ok: true, date, macros, micros, water_ml: log.water_ml || 0 });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ ok: false, error: "Internal server error" });
    }
  });
}
