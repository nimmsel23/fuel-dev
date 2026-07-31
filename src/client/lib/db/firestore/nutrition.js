/**
 * Firestore Nutrition — Katalog, Tages-Logs, History, Wochen-Mikros
 *
 * Collections: nutrition/{uid}/meta/catalog, nutrition/{uid}/logs/{date},
 *              nutrition/public/meta/micros, knowledge_tasks/{id}
 */

import {
  doc, getDoc, setDoc, collection, query, where, getDocs,
  orderBy, limit, documentId, serverTimestamp, writeBatch, deleteField,
} from "firebase/firestore";
import { db } from "../../firebase.js";
import { getUid } from "./core.js";
import { MICRO_KEYS, zeroMicros, todayISO, getWeekDates } from "./utils.js";
import { getSupplementsCatalog } from "./supplements.js";

export async function getNutritionCatalog() {
  const ref = doc(db, "nutrition", getUid(), "meta", "catalog");
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().items || []) : [];
}

export async function getMicrosCatalog() {
  const ref = doc(db, "nutrition", "public", "meta", "micros");
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().items || []) : [];
}

export async function saveMicrosCatalog(items) {
  const ref = doc(db, "nutrition", "public", "meta", "micros");
  await setDoc(ref, { items, updated_at: serverTimestamp() }, { merge: true });
}

export async function getNutritionLog(date = todayISO()) {
  const snap = await getDoc(doc(db, "nutrition", getUid(), "logs", date));
  return snap.exists() ? snap.data() : { date, meals: [], water_ml: 0 };
}

export async function saveNutritionLog(date, data) {
  const payload = { ...data, updated_at: serverTimestamp() };
  // Mikros-Tages-Cache (siehe getWeeklyMicros) wird ungültig, sobald die
  // Mahlzeiten-Liste angefasst wird — sonst zeigt die Wochenansicht veraltete
  // Summen. Der Cache-Write selbst läuft über cacheDayMicroTotals() (unten),
  // nicht über diese Funktion, kollidiert also nicht mit der Invalidierung hier.
  if ("meals" in data) {
    payload.micro_totals = deleteField();
    payload.micro_totals_complete = deleteField();
  }
  await setDoc(doc(db, "nutrition", getUid(), "logs", date), payload, { merge: true });
}

// Schreibt den gecachten Tages-Mikros-Stand zurück — inkl. der pro-Meal
// aufgelösten Mikros (meal.micros), die computeMealMicroTotals() in-place
// auf den übergebenen meals-Objekten gesetzt hat. Bewusst getrennt von
// saveNutritionLog(), damit dieser Cache-Write sich nicht selbst invalidiert.
async function cacheDayMicroTotals(date, meals, totals, complete) {
  await setDoc(doc(db, "nutrition", getUid(), "logs", date), {
    meals,
    micro_totals: totals,
    micro_totals_complete: complete,
    updated_at: serverTimestamp(),
  }, { merge: true });
}

export async function getNutritionLogsInRange(dates) {
  const uid = getUid();
  const map = {};
  await Promise.all(dates.map(async (date) => {
    const snap = await getDoc(doc(db, "nutrition", uid, "logs", date));
    if (snap.exists()) map[date] = snap.data();
  }));
  return map;
}

// Kanonisch für Cross-Tempel-Konsumenten (z.B. der Journal-Aggregator in
// journal-dev/vitalos). Dokument-IDs sind YYYY-MM-DD, also lexikographisch
// = chronologisch sortierbar.
export async function getMealsHistory(limitCount = 30) {
  try {
    const q = query(
      collection(db, "nutrition", getUid(), "logs"),
      orderBy("updated_at", "desc"),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ date: d.id, ...d.data() }))
      .filter(log => (log.meals || []).length > 0);
  } catch (error) {
    console.error("[getMealsHistory] Query failed, fallback to unordered:", error);
    // Fallback: alle Logs laden, ungeordnet
    const snap = await getDocs(collection(db, "nutrition", getUid(), "logs"));
    return snap.docs
      .map(d => ({ date: d.id, ...d.data() }))
      .filter(log => (log.meals || []).length > 0)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }
}

export async function deleteMealFromLog(date, mealId) {
  const log = await getNutritionLog(date);
  if (!log.meals) return;
  const filtered = log.meals.filter(m => m.id !== mealId);
  await saveNutritionLog(date, { ...log, meals: filtered });
}

export async function searchNutritionCatalog(q, limit = 20) {
  const items = await getNutritionCatalog();
  const lowerQ = q.toLowerCase();
  return items
    .filter(i => i.name.toLowerCase().includes(lowerQ))
    .slice(0, limit);
}

// Löst die Mikros einer Mahlzeit auf (Katalog-Name-Lookup, kcal-skaliert) und
// cached sie in-place auf `meal.micros` — Pendant zu
// server/services/nutrition-micros.mjs#resolveMealMicros für den Cloud-Channel.
function resolveMealMicros(meal, catalog, microsMap) {
  if (meal.micros) return meal.micros;

  const catalogEntry = catalog.find((i) => (meal.catalog_id && i.id === meal.catalog_id) || i.name === meal.description);
  const lookupName = catalogEntry?.name || meal.description;
  const micros = microsMap[lookupName];
  if (!micros) return null;

  let factor = 1;
  if (meal.kcal && micros.kcal) factor = meal.kcal / micros.kcal;

  const resolved = {};
  for (const k of MICRO_KEYS) {
    resolved[k] = Math.round((micros[k] || 0) * factor * 10) / 10;
  }
  meal.micros = resolved;
  return resolved;
}

function computeMealMicroTotals(meals, catalog, microsMap) {
  const totals = zeroMicros();
  let complete = true;
  const missing = [];
  for (const meal of meals || []) {
    const micros = resolveMealMicros(meal, catalog, microsMap);
    if (!micros) {
      complete = false;
      const catalogEntry = catalog.find((i) => (meal.catalog_id && i.id === meal.catalog_id) || i.name === meal.description);
      missing.push(catalogEntry?.name || meal.description);
      continue;
    }
    for (const k of MICRO_KEYS) {
      totals[k] = Math.round((totals[k] + micros[k]) * 10) / 10;
    }
  }
  return { totals, complete, missing };
}

export async function getWeeklyMicros(year, week) {
  const dates = getWeekDates(year, week);
  const logsMap = await getNutritionLogsInRange(dates);
  const suppLogsSnap = await getDocs(query(collection(db, "supplements", getUid(), "logs"), where("date", "in", dates)));
  const suppLogsMap = {};
  suppLogsSnap.forEach(d => { suppLogsMap[d.id] = d.data(); });

  const catalog = await getNutritionCatalog();
  const suppCatalog = await getSupplementsCatalog();
  const microsCatalog = await getMicrosCatalog();

  const suppCatalogMap = Object.fromEntries(suppCatalog.map(i => [i.id, i]));
  const microsMap = Object.fromEntries(microsCatalog.map(i => [i.meal_name, i]));

  const weekTotals = zeroMicros();
  const dayBreakdown = {};
  const missingMeals = new Set();

  for (const date of dates) {
    const log = logsMap[date] || { meals: [] };
    let mealTotals;

    if (log.micro_totals && log.micro_totals_complete) {
      // Gecacht (voriger Request oder beim Loggen aufgelöst) — kein Rechnen nötig.
      mealTotals = log.micro_totals;
    } else {
      const { totals, complete, missing } = computeMealMicroTotals(log.meals, catalog, microsMap);
      mealTotals = totals;
      missing.forEach((m) => missingMeals.add(m));

      // Selbstheilend zurückschreiben, sobald irgendeine Mahlzeit neu
      // aufgelöst wurde. complete=false wird mitgespeichert, aber die
      // Read-Prüfung oben verlangt complete=true — ein unvollständiger Tag
      // wird beim nächsten Request automatisch erneut versucht.
      if ((log.meals || []).some((m) => m.micros)) {
        await cacheDayMicroTotals(date, log.meals, totals, complete).catch((err) =>
          console.error(`[getWeeklyMicros] Cache-Write für ${date} fehlgeschlagen:`, err)
        );
      }
    }

    const dayTotals = { ...mealTotals };
    const suppLog = suppLogsMap[date] || { intakes: [] };
    for (const intake of suppLog.intakes || []) {
      const entry = suppCatalogMap[intake.supplement_id];
      if (entry?.micros) {
        let factor = 1;
        if (intake.dose != null && entry.default_dose != null && entry.default_dose > 0) {
          factor = intake.dose / entry.default_dose;
        }

        for (const k of MICRO_KEYS) {
          if (entry.micros[k]) {
            dayTotals[k] = Math.round((dayTotals[k] + (entry.micros[k] * factor)) * 10) / 10;
          }
        }
      }
    }

    dayBreakdown[date] = dayTotals;
    for (const k of MICRO_KEYS) {
      weekTotals[k] = Math.round((weekTotals[k] + dayTotals[k]) * 10) / 10;
    }
  }

  // Batch write all missing meals as knowledge tasks
  if (missingMeals.size > 0) {
    const batch = writeBatch(db);
    for (const lookupName of missingMeals) {
      const taskId = `enrich_${btoa(unescape(encodeURIComponent(lookupName))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`;
      const taskRef = doc(db, "knowledge_tasks", taskId);
      batch.set(taskRef, {
        id: lookupName,
        type: "enrich_meal",
        description: lookupName,
        status: "pending",
        created_at: serverTimestamp()
      }, { merge: true });
    }
    await batch.commit().catch(err => console.error("Failed to commit knowledge tasks batch:", err));
  }

  // Comparison logic is handled by the caller or we can import it, but shared/config/dach.mjs is ESM
  // Since we are in the client, we can just import it.
  const { DACH, getStatus } = await import("../../../../shared/config/dach.mjs");
  const rda_comparison = {};
  for (const [key, dach] of Object.entries(DACH)) {
    const avg = weekTotals[key] / 7;
    rda_comparison[key] = {
      dach: dach.value,
      unit: dach.unit,
      total_week: Math.round(weekTotals[key] * 10) / 10,
      avg_daily: Math.round(avg * 10) / 10,
      percent_of_dach: Math.round((avg / dach.value) * 100),
      status: getStatus(avg, dach.value),
    };
  }

  return { ok: true, year, week, dates, week_totals: weekTotals, rda_comparison, day_breakdown: dayBreakdown, missing_meals: Array.from(missingMeals) };
}

export async function getFastingWindows(days = 14) {
  const { computeFastingWindows } = await import("../../../../shared/utils/fasting.mjs");
  const { todayISO } = await import("./utils.js");

  // Build array of last `days + 1` dates (oldest first)
  const dates = [];
  const today = new Date(todayISO());
  for (let i = days; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }

  const logsMap = await getNutritionLogsInRange(dates);
  const dayLogs = dates.map((date) => ({
    date,
    meals: logsMap[date]?.meals || [],
  }));

  const windows = computeFastingWindows(dayLogs);

  // Return only last `days` entries (discard extra first day used for context)
  return windows.slice(-days);
}
