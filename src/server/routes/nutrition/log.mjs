import { z } from "zod";
import { isISODate, todayISO } from "../../../shared/utils/validation.mjs";
import path from "path";
import fs from "fs";
import { loadCatalog } from "../../services/nutrition-catalog.mjs";
import { estimateMicros } from "../../services/nutrition-estimate-micros.mjs";
import { getMicrosForMeal, saveMicrosForMeal } from "../../services/nutrition-micros.mjs";
import { upsertMeal, deleteMeal as deleteMealRow, upsertWater, getMealsForDate } from "../../services/nutrition-db.mjs";

const logPostSchema = z.object({
  date: z.string().optional(),
  meal: z.object({
    type: z.string().optional(),
    description: z.string().min(1),
    notes: z.string().optional(),
    catalog_id: z.string().optional(),
    kcal: z.coerce.number().min(0).optional(),
    protein: z.coerce.number().min(0).optional(),
    carbs: z.coerce.number().min(0).optional(),
    fat: z.coerce.number().min(0).optional(),
  }).optional(),
  // Quicklog from catalog: resolve macros server-side
  catalog_item_id: z.string().optional(),
  catalog_addon_ids: z.array(z.string()).optional(),
  delete_meal_id: z.string().optional(),
  water_ml: z.coerce.number().optional(),
});

function loadLog(date, nutritionDir) {
  const filePath = path.join(nutritionDir, `${date}.json`);
  if (fs.existsSync(filePath)) {
    try { return JSON.parse(fs.readFileSync(filePath, "utf-8")); } catch { /* fall through */ }
  }
  return { date, meals: [], water_ml: 0 };
}

function saveLog(log, nutritionDir) {
  fs.writeFileSync(path.join(nutritionDir, `${log.date}.json`), JSON.stringify(log, null, 2), "utf-8");
  syncLogToDb(log);
}

// Schreibt den Tag komplett nach SQLite durch (meals als Rows, id-basiert
// upsertet + verwaiste Rows gelöscht). SQLite ist damit die normalisierte
// Sicht auf dieselben Daten wie die Tages-JSON — der JSON-Blob bleibt
// vorerst der Lesepfad (loadLog), SQLite existiert parallel als
// Row-granulare Quelle für zukünftigen Firestore-Row-Sync (siehe
// _merge_by_id-Fix in firestored/adapters/vitalos.py, 2026-07-23).
function syncLogToDb(log) {
  try {
    const existing = getMealsForDate(log.date);
    const currentIds = new Set((log.meals || []).filter((m) => m.id).map((m) => m.id));
    for (const row of existing) {
      if (!currentIds.has(row.id)) deleteMealRow(row.id);
    }
    for (const meal of log.meals || []) {
      if (!meal.id) {
        console.warn(`[nutrition-db] Meal ohne id in ${log.date} übersprungen:`, meal.description);
        continue;
      }
      upsertMeal({ ...meal, date: log.date });
    }
    upsertWater(log.date, log.water_ml || 0);
  } catch (e) {
    console.warn(`[nutrition-db] Sync-Fehler für ${log.date}:`, e.message);
  }
}

// Der Tages-Mikros-Cache (log.micro_totals, siehe weekly.mjs/daily.mjs) wird
// bei jeder Log-Änderung ungültig — sonst zeigt /nutrition/weekly veraltete
// Summen. Einfache Invalidierung statt inkrementeller Pflege: nächster Read
// rechnet den Tag einmalig neu (und cached wieder).
function invalidateMicroCache(log) {
  delete log.micro_totals;
  delete log.micro_totals_complete;
}

function resolveCatalogItem(catalog, catalogItemId, addonIds = []) {
  const item = catalog.items.find((i) => i.id === catalogItemId);
  if (!item) return null;

  const addonSet = new Set(addonIds.length > 0 ? addonIds : (item.default_addon_ids || []));
  const selectedAddons = (item.addons || []).filter((a) => addonSet.has(a.id));

  const base = { kcal: item.kcal || 0, protein: item.protein || 0, carbs: item.carbs || 0, fat: item.fat || 0 };
  const totals = selectedAddons.reduce(
    (acc, a) => ({
      kcal:    acc.kcal    + (a.kcal    || 0),
      protein: acc.protein + (a.protein || 0),
      carbs:   acc.carbs   + (a.carbs   || 0),
      fat:     acc.fat     + (a.fat     || 0),
    }),
    base
  );

  const addonLabel = selectedAddons.map((a) => a.label).join(", ");
  const description = addonLabel ? `${item.name} (${addonLabel})` : item.name;

  return {
    catalog_id: item.id,
    type: item.meal_type || "meal",
    description,
    notes: item.notes || "",
    kcal:    Math.round(totals.kcal    * 10) / 10,
    protein: Math.round(totals.protein * 10) / 10,
    carbs:   Math.round(totals.carbs   * 10) / 10,
    fat:     Math.round(totals.fat     * 10) / 10,
  };
}

const logPatchSchema = z.object({
  date: z.string().optional(),
  meal_id: z.string().min(1),
  new_date: z.string().optional(),
  meal: z.object({
    type: z.string().optional(),
    description: z.string().min(1).optional(),
    notes: z.string().optional(),
    kcal: z.coerce.number().min(0).optional(),
    protein: z.coerce.number().min(0).optional(),
    carbs: z.coerce.number().min(0).optional(),
    fat: z.coerce.number().min(0).optional(),
  }).optional(),
});

function fireMicrosEstimate(description, kcal) {
  if (!description || getMicrosForMeal(description)) return;
  estimateMicros(description)
    .then((micros) => {
      if (Object.keys(micros).length > 0) {
        saveMicrosForMeal(description, kcal, micros, "gemini-log");
      }
    })
    .catch((e) => console.warn(`[micros] estimate failed for "${description}":`, e.message));
}

export default async function logRoute(app) {
  app.get("/nutrition/log", async (req, reply) => {
    const date = (req.query.date || todayISO()).toString();
    if (!isISODate(date)) return reply.status(400).send({ ok: false, error: "Invalid date" });
    return reply.send({ ok: true, data: loadLog(date, req.paths.nutrition) });
  });

  app.get("/nutrition/history", async (req, reply) => {
    const limitCount = parseInt(req.query.limit || "30");
    const nutritionDir = req.paths.nutrition;
    const files = fs.readdirSync(nutritionDir)
      .filter((f) => f.match(/^\d{4}-\d{2}-\d{2}\.json$/))
      .sort()
      .reverse()
      .slice(0, limitCount);

    const history = files.map((f) => {
      const data = JSON.parse(fs.readFileSync(path.join(nutritionDir, f), "utf-8"));
      return { date: f.replace(".json", ""), ...data };
    }).filter((log) => (log.meals || []).length > 0);

    return reply.send({ ok: true, history });
  });

  app.patch("/nutrition/log", async (req, reply) => {
    try {
      const parsed = logPatchSchema.safeParse(req.body || {});
      if (!parsed.success) return reply.status(400).send({ ok: false, error: "Invalid data" });

      const { meal_id, meal: updates, new_date } = parsed.data;
      const date = (parsed.data.date || todayISO()).toString();
      if (!isISODate(date)) return reply.status(400).send({ ok: false, error: "Invalid date" });
      if (new_date && !isISODate(new_date)) return reply.status(400).send({ ok: false, error: "Invalid new_date" });

      const sourceLog = loadLog(date, req.paths.nutrition);
      const mealIndex = sourceLog.meals.findIndex((m) => m.id === meal_id);
      if (mealIndex === -1) return reply.status(404).send({ ok: false, error: "Meal not found" });

      const meal = { ...sourceLog.meals[mealIndex] };

      if (updates) {
        Object.assign(meal, Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined)));
        // kcal/description geändert → gecachte Mikros (auf altes kcal skaliert) sind stale.
        delete meal.micros;
      }

      if (new_date && new_date !== date) {
        sourceLog.meals.splice(mealIndex, 1);
        invalidateMicroCache(sourceLog);
        saveLog(sourceLog, req.paths.nutrition);
        const targetLog = loadLog(new_date, req.paths.nutrition);
        targetLog.meals.push({ ...meal, id: `meal_${Date.now()}` });
        invalidateMicroCache(targetLog);
        saveLog(targetLog, req.paths.nutrition);
        return reply.send({ ok: true, data: targetLog });
      } else {
        sourceLog.meals[mealIndex] = meal;
        invalidateMicroCache(sourceLog);
        saveLog(sourceLog, req.paths.nutrition);
        return reply.send({ ok: true, data: sourceLog });
      }
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ ok: false, error: "Internal server error" });
    }
  });

  app.post("/nutrition/log", async (req, reply) => {
    try {
      const parsed = logPostSchema.safeParse(req.body || {});
      if (!parsed.success) return reply.status(400).send({ ok: false, error: "Invalid data" });

      const date = (parsed.data.date || todayISO()).toString();
      if (!isISODate(date)) return reply.status(400).send({ ok: false, error: "Invalid date" });

      const log = loadLog(date, req.paths.nutrition);

      if (parsed.data.catalog_item_id) {
        const catalog = loadCatalog();
        const resolved = resolveCatalogItem(catalog, parsed.data.catalog_item_id, parsed.data.catalog_addon_ids);
        if (!resolved) return reply.status(404).send({ ok: false, error: "Catalog item not found" });
        log.meals.push({ id: `meal_${Date.now()}`, ...resolved, time: new Date().toISOString() });
        fireMicrosEstimate(resolved.description, resolved.kcal);
      } else if (parsed.data.meal) {
        const m = parsed.data.meal;
        log.meals.push({
          id: `meal_${Date.now()}`,
          catalog_id: m.catalog_id || null,
          type: m.type || "meal",
          description: m.description,
          notes: m.notes || "",
          kcal: m.kcal || 0, protein: m.protein || 0, carbs: m.carbs || 0, fat: m.fat || 0,
          time: new Date().toISOString(),
        });
        fireMicrosEstimate(m.description, m.kcal || 0);
      }

      if (parsed.data.delete_meal_id) {
        log.meals = log.meals.filter((m) => m.id !== parsed.data.delete_meal_id);
      }
      if (parsed.data.water_ml !== undefined) {
        log.water_ml = parsed.data.water_ml;
      }

      invalidateMicroCache(log);
      saveLog(log, req.paths.nutrition);
      return reply.send({ ok: true, data: log });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ ok: false, error: "Internal server error" });
    }
  });
}
