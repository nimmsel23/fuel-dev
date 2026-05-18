import { z } from "zod";
import { searchNutrition } from "../../services/nutrition-search.mjs";
import { isISODate } from "../../lib/validation.mjs";
import { getMeal } from "../../services/nutrition-db.mjs";
import { loadMicrosCatalog } from "../../services/nutrition-micros.mjs";
import path from "path";
import fs from "fs";
import { NUTRITION_DIR } from "../../config/paths.mjs";

const searchQuerySchema = z.object({
  q: z.string().min(1, "q required"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
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

export default async function dailyRoute(app) {
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
