import path from "path";
import fs from "fs";
import { NUTRITION_DIR, NUTRITION_CATALOG_PATH } from "../../config/paths.mjs";
import { loadMicrosCatalog, getMicrosForComponents, zeroMicros } from "../../services/nutrition-micros.mjs";
import { DACH, getStatus } from "../../config/dach.mjs";

const MICRO_KEYS = Object.keys(DACH);

function getWeekDates(year, week) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(ISOweekStart);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

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

// Collect all components + addons from a catalog entry (addons = default ones only)
function getEffectiveComponents(catalogItem) {
  const components = [...(catalogItem.components || [])];
  const defaultAddonIds = new Set(catalogItem.default_addon_ids || []);
  for (const addon of catalogItem.addons || []) {
    if (defaultAddonIds.has(addon.id)) components.push(addon);
  }
  return components;
}

export default async function weeklyRoute(app) {
  app.get("/nutrition/weekly/:year/:week", async (req, reply) => {
    try {
      const y = parseInt(req.params.year);
      const w = parseInt(req.params.week);

      if (isNaN(y) || isNaN(w) || w < 1 || w > 53) {
        return reply.status(400).send({ ok: false, error: "Invalid year or week" });
      }

      const dates = getWeekDates(y, w);
      const microsCatalog = loadMicrosCatalog();
      const mealCatalog = loadMealCatalog();

      const weekTotals = zeroMicros();
      const dayBreakdown = {};

      for (const date of dates) {
        const log = loadLog(date);
        const dayTotals = zeroMicros();

        for (const meal of log.meals || []) {
          // Find catalog entry via catalog_id or description fallback
          const catalogEntry = mealCatalog.items.find(
            (i) => (meal.catalog_id && i.id === meal.catalog_id) ||
                    i.name === meal.description ||
                    i.description === meal.description
          );

          if (!catalogEntry) continue;

          const components = getEffectiveComponents(catalogEntry);
          const { micros } = getMicrosForComponents(components, microsCatalog);

          for (const k of MICRO_KEYS) {
            dayTotals[k] = Math.round((dayTotals[k] + micros[k]) * 10) / 10;
          }
        }

        dayBreakdown[date] = dayTotals;
        for (const k of MICRO_KEYS) {
          weekTotals[k] = Math.round((weekTotals[k] + dayTotals[k]) * 10) / 10;
        }
      }

      const status = {};
      for (const [key, dach] of Object.entries(DACH)) {
        const avg = weekTotals[key] / 7;
        status[key] = {
          dach: dach.value,
          unit: dach.unit,
          total_week: Math.round(weekTotals[key] * 10) / 10,
          avg_daily: Math.round(avg * 10) / 10,
          percent_of_dach: Math.round((avg / dach.value) * 100),
          status: getStatus(avg, dach.value),
        };
      }

      return reply.send({
        ok: true,
        year: y,
        week: w,
        dates,
        week_totals: weekTotals,
        rda_comparison: status,
        day_breakdown: dayBreakdown,
      });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ ok: false, error: "Internal server error" });
    }
  });
}
