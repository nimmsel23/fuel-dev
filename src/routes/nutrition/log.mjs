import { z } from "zod";
import { isISODate, todayISO } from "../../lib/validation.mjs";
import path from "path";
import fs from "fs";
import { NUTRITION_DIR } from "../../config/paths.mjs";

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
  meal_id: z.coerce.number().optional(),
  update_meal: z.any().optional(),
  delete_meal_id: z.string().optional(),
  water_ml: z.coerce.number().optional(),
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

export default async function logRoute(app) {
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
          meal_id: parsed.data.meal_id || null,
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
}
