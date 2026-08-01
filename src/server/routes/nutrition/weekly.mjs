import path from "path";
import fs from "fs";
import { NUTRITION_DIR } from "../../config/paths.mjs";
import { zeroMicros, MICRO_KEYS, computeMealMicroTotals } from "../../services/nutrition-micros.mjs";
import { loadCatalog } from "../../services/nutrition-catalog.mjs";
import { loadCatalog as loadSupplementsCatalog } from "../../services/supplements-catalog.mjs";
import { loadLog as loadSupplementLog } from "../../services/supplements-log.mjs";
import { DACH, getStatus } from "../../../shared/config/dach.mjs";

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

function loadNutritionLog(date) {
  const filePath = path.join(NUTRITION_DIR, `${date}.json`);
  if (fs.existsSync(filePath)) {
    try { return JSON.parse(fs.readFileSync(filePath, "utf-8")); } catch { /* fall through */ }
  }
  return { date, meals: [], water_ml: 0 };
}

function saveNutritionLog(log) {
  fs.writeFileSync(path.join(NUTRITION_DIR, `${log.date}.json`), JSON.stringify(log, null, 2), "utf-8");
}

// Gibt zusätzlich die Pro-Supplement-Beiträge zurück (für Modal-Aufschlüsselung
// "welcher Eintrag hat wie viel beigetragen") — dayTotals bleibt wie bisher
// die aufsummierte Quelle für Heatmap/Status.
function addSupplementMicros(dayTotals, date, supplementCatalogMap) {
  const suppLog = loadSupplementLog(date);
  const contributions = [];
  for (const intake of suppLog.intakes || []) {
    const entry = supplementCatalogMap[intake.supplement_id];
    if (!entry?.micros) continue;

    let factor = 1;
    if (intake.dose != null && entry.default_dose != null && entry.default_dose > 0) {
      factor = intake.dose / entry.default_dose;
    }

    const scaledMicros = {};
    for (const k of MICRO_KEYS) {
      if (entry.micros[k]) {
        const v = Math.round(entry.micros[k] * factor * 10) / 10;
        scaledMicros[k] = v;
        dayTotals[k] = Math.round((dayTotals[k] + v) * 10) / 10;
      }
    }
    contributions.push({
      kind: "supplement",
      name: entry.name || intake.supplement_id,
      dose: intake.dose,
      unit: entry.unit || "",
      micros: scaledMicros,
    });
  }
  return contributions;
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
      const catalog = loadCatalog();
      const suppCatalog = loadSupplementsCatalog();
      const suppCatalogMap = Object.fromEntries(suppCatalog.items.map((i) => [i.id, i]));

      const weekTotals = zeroMicros();
      const dayBreakdown = {};
      const mealBreakdown = {};

      for (const date of dates) {
        const log = loadNutritionLog(date);
        let mealTotals;

        if (log.micro_totals && log.micro_totals_complete) {
          // Gecacht (aus einem vorherigen Request oder beim Loggen aufgelöst) — kein Rechnen nötig.
          mealTotals = log.micro_totals;
        } else {
          const { totals, complete } = computeMealMicroTotals(log.meals, catalog);
          mealTotals = totals;

          // Selbstheilend zurückschreiben, sobald irgendeine Mahlzeit neu
          // aufgelöst wurde (per-Meal-Cache spart beim nächsten Lauf Zeit).
          // complete=false wird mitgespeichert, aber die Read-Prüfung oben
          // verlangt complete=true — ein unvollständiger Tag wird also beim
          // nächsten Request automatisch erneut versucht, statt als 0 zu
          // erstarren.
          if ((log.meals || []).some((m) => m.micros)) {
            log.micro_totals = totals;
            log.micro_totals_complete = complete;
            saveNutritionLog(log);
          }

          if (!complete) {
            for (const meal of log.meals || []) {
              if (meal.micros || !meal.description) continue;
              const lookupName = meal.description;
              import("../../services/nutrition-estimate-micros.mjs").then(({ estimateMicros }) => {
                import("../../services/nutrition-micros.mjs").then(({ saveMicrosForMeal }) => {
                  estimateMicros(lookupName).then((est) => {
                    if (Object.keys(est).length > 0) {
                      saveMicrosForMeal(lookupName, meal.kcal || 0, est, "gemini");
                      console.log(`[micros] Background estimation completed for: ${lookupName}`);
                    }
                  });
                });
              });
            }
          }
        }

        const dayTotals = { ...mealTotals };
        const suppContributions = addSupplementMicros(dayTotals, date, suppCatalogMap);

        dayBreakdown[date] = dayTotals;
        for (const k of MICRO_KEYS) {
          weekTotals[k] = Math.round((weekTotals[k] + dayTotals[k]) * 10) / 10;
        }

        // Pro-Eintrag-Aufschlüsselung fürs Detail-Modal ("welcher Eintrag hat
        // wie viel beigetragen"). log.meals[].micros ist an dieser Stelle
        // bereits aufgelöst (computeMealMicroTotals mutiert in-place) oder
        // stammt aus dem Cache (beim ersten Auflösen persistiert).
        const mealContributions = (log.meals || [])
          .filter((m) => m.micros)
          .map((m) => ({ kind: "meal", name: m.description, kcal: m.kcal || 0, micros: m.micros }));
        mealBreakdown[date] = [...mealContributions, ...suppContributions];
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

      return reply.send({ ok: true, year: y, week: w, dates, week_totals: weekTotals, rda_comparison: status, day_breakdown: dayBreakdown, meal_breakdown: mealBreakdown });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ ok: false, error: "Internal server error" });
    }
  });
}
