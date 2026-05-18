import path from "path";
import fs from "fs";
import { NUTRITION_DIR } from "../../config/paths.mjs";
import { loadMicrosCatalog } from "../../services/nutrition-micros.mjs";
import { RDA, getStatus } from "../../config/rda.mjs";

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
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      return { date, meals: [], water_ml: 0 };
    }
  }
  return { date, meals: [], water_ml: 0 };
}

export default async function weeklyRoute(app) {
  // GET /nutrition/weekly/:year/:week — Get weekly micronutrient totals + RDA comparison
  app.get("/nutrition/weekly/:year/:week", async (req, reply) => {
    try {
      const { year, week } = req.params;
      const y = parseInt(year);
      const w = parseInt(week);

      if (isNaN(y) || isNaN(w) || w < 1 || w > 53) {
        return reply.status(400).send({ ok: false, error: "Invalid year or week" });
      }

      const dates = getWeekDates(y, w);
      const microsCatalog = loadMicrosCatalog();

      // Aggregate micros for the week
      const weekTotals = {
        vitamin_b12_ug: 0,
        calcium_mg: 0,
        iron_mg: 0,
        vitamin_d_ug: 0,
        vitamin_e_mg: 0,
        folate_ug: 0,
        magnesium_mg: 0,
        zinc_mg: 0,
        sodium_mg: 0,
        potassium_mg: 0,
      };

      const dayBreakdown = {};

      for (const date of dates) {
        const log = loadLog(date);
        dayBreakdown[date] = { ...weekTotals };

        for (const meal of log.meals || []) {
          const microItem = microsCatalog.items.find(
            (item) => item.name === meal.description
          );
          if (microItem) {
            for (const key of Object.keys(weekTotals)) {
              dayBreakdown[date][key] += microItem[key] || 0;
              weekTotals[key] += microItem[key] || 0;
            }
          }
        }
      }

      // Calculate averages and status
      const avgDaily = {};
      const status = {};

      for (const [key, rda] of Object.entries(RDA)) {
        const avg = weekTotals[key] / 7;
        avgDaily[key] = Math.round(avg * 10) / 10;
        status[key] = {
          rda: rda.value,
          total_week: Math.round(weekTotals[key] * 10) / 10,
          avg_daily: Math.round(avg * 10) / 10,
          percent_of_rda: Math.round((avg / rda.value) * 100),
          status: getStatus(avg, rda.value),
        };
      }

      return reply.send({
        ok: true,
        year: y,
        week: w,
        dates,
        week_totals: weekTotals,
        avg_daily: avgDaily,
        rda_comparison: status,
        day_breakdown: dayBreakdown,
      });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ ok: false, error: "Internal server error" });
    }
  });
}
