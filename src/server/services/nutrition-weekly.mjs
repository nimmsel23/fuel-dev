import path from "path";
import fs from "fs";
import { zeroMicros, MICRO_KEYS, computeMealMicroTotals } from "./nutrition-micros.mjs";
import { loadCatalog } from "./nutrition-catalog.mjs";
import { loadCatalog as loadSupplementsCatalog } from "./supplements-catalog.mjs";
import { loadLog as loadSupplementLog } from "./supplements-log.mjs";
import { pushNutritionLog } from "../lib/firestore-admin.mjs";
import { DACH, getStatus } from "../../shared/config/dach.mjs";

// Wochen-Assembly für die Mikro-Sicht. Ausgelagert aus routes/nutrition/weekly.mjs,
// damit /nutrition/weekly/:year/:week und /nutrition/weekly/:year/:week/micro/:key
// (micro-trend.mjs) exakt dieselbe Datengrundlage teilen statt sie zu duplizieren.

function nowIso() {
  return new Date().toISOString();
}

export function getWeekDates(year, week) {
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

function loadNutritionLog(date, nutritionDir) {
  const filePath = path.join(nutritionDir, `${date}.json`);
  if (fs.existsSync(filePath)) {
    try { return JSON.parse(fs.readFileSync(filePath, "utf-8")); } catch { /* fall through */ }
  }
  return { date, meals: [], water_ml: 0 };
}

function saveNutritionLog(log, nutritionDir) {
  fs.writeFileSync(path.join(nutritionDir, `${log.date}.json`), JSON.stringify(log, null, 2), "utf-8");
}

// Gibt zusätzlich die Pro-Supplement-Beiträge zurück (für Modal-Aufschlüsselung
// "welcher Eintrag hat wie viel beigetragen") — dayTotals bleibt wie bisher
// die aufsummierte Quelle für Heatmap/Status.
function addSupplementMicros(dayTotals, date, supplementCatalogMap, supplementsLogDir) {
  const suppLog = loadSupplementLog(date, supplementsLogDir);
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
      micros_meta: {
        source: "supplement_catalog",
        lookup_name: entry.name || intake.supplement_id,
        inferred_from: intake.supplement_id,
        normalized_key: null,
        scaling_factor: Math.round((factor || 1) * 1000) / 1000,
        resolved_at: nowIso(),
        origin: "supplement",
      },
    });
  }
  return contributions;
}

// Baut die Wochen-Mikro-Aggregation. ctx = { paths, uid } (paths = req.paths).
// Rückgabe: { dates, week_totals, rda_comparison, day_breakdown, meal_breakdown }.
export async function assembleWeek(year, week, ctx) {
  const { paths: reqPaths, uid } = ctx;
  const dates = getWeekDates(year, week);
  const catalog = loadCatalog(reqPaths.nutrition, { uid });
  const suppCatalog = loadSupplementsCatalog(reqPaths.supplements, { uid });
  const suppCatalogMap = Object.fromEntries(suppCatalog.items.map((i) => [i.id, i]));
  const microOptions = { nutritionDir: reqPaths.nutrition, nutritionDbPath: reqPaths.nutritionDb, uid };

  const weekTotals = zeroMicros();
  const dayBreakdown = {};
  const mealBreakdown = {};

  for (const date of dates) {
    const log = loadNutritionLog(date, reqPaths.nutrition);
    let mealTotals;

    if (log.micro_totals && log.micro_totals_complete) {
      // Gecacht (aus einem vorherigen Request oder beim Loggen aufgelöst) — kein Rechnen nötig.
      mealTotals = log.micro_totals;
    } else {
      const hadPersistedMicros = (log.meals || []).some((m) => m.micros);
      const { totals, complete } = computeMealMicroTotals(log.meals, catalog, microOptions);
      mealTotals = totals;

      // Selbstheilend zurückschreiben, sobald irgendeine Mahlzeit neu
      // aufgelöst wurde (per-Meal-Cache spart beim nächsten Lauf Zeit).
      // complete=false wird mitgespeichert, aber die Read-Prüfung oben
      // verlangt complete=true — ein unvollständiger Tag wird also beim
      // nächsten Request automatisch erneut versucht, statt als 0 zu
      // erstarren.
      const hasResolvedMicros = (log.meals || []).some((m) => m.micros);
      if (hasResolvedMicros) {
        log.micro_totals = totals;
        log.micro_totals_complete = complete;
        saveNutritionLog(log, reqPaths.nutrition);
        if (!hadPersistedMicros) {
          void pushNutritionLog(date, log.meals, log.water_ml || 0, {
            uid,
            nutritionDir: reqPaths.nutrition,
          }).catch(() => {});
        }
      }

      if (!complete) {
        for (const meal of log.meals || []) {
          if (meal.micros || !meal.description) continue;
          const lookupName = meal.description;
          import("./nutrition-estimate-micros.mjs").then(({ estimateMicros }) => {
            import("./nutrition-micros.mjs").then(({ saveMicrosForMeal }) => {
              estimateMicros(lookupName).then((est) => {
                if (Object.keys(est).length > 0) {
                  saveMicrosForMeal(lookupName, meal.kcal || 0, est, "gemini", microOptions);
                  const refreshed = loadNutritionLog(date, reqPaths.nutrition);
                  const target = (refreshed.meals || []).find((m) => m.id === meal.id);
                  if (target) {
                    target.micros = {};
                    for (const k of MICRO_KEYS) {
                      target.micros[k] = Math.round((est[k] || 0) * 10) / 10;
                    }
                    target.micros_meta = {
                      source: "gemini",
                      lookup_name: lookupName,
                      inferred_from: lookupName,
                      normalized_key: null,
                      scaling_factor: 1,
                      resolved_at: nowIso(),
                      origin: "background_estimate",
                    };
                    delete refreshed.micro_totals;
                    delete refreshed.micro_totals_complete;
                    saveNutritionLog(refreshed, reqPaths.nutrition);
                    void pushNutritionLog(date, refreshed.meals, refreshed.water_ml || 0, {
                      uid,
                      nutritionDir: reqPaths.nutrition,
                    }).catch(() => {});
                  }
                  console.log(`[micros] Background estimation completed for: ${lookupName}`);
                }
              });
            });
          });
        }
      }
    }

    const dayTotals = { ...mealTotals };
    const suppContributions = addSupplementMicros(dayTotals, date, suppCatalogMap, reqPaths.supplementsLog);

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
      .map((m) => ({ kind: "meal", name: m.description, kcal: m.kcal || 0, micros: m.micros, micros_meta: m.micros_meta || null }));
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

  return {
    dates,
    week_totals: weekTotals,
    rda_comparison: status,
    day_breakdown: dayBreakdown,
    meal_breakdown: mealBreakdown,
  };
}
