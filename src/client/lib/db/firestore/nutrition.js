/**
 * Firestore Nutrition — Katalog, Tages-Logs, History, Wochen-Mikros
 *
 * Collections: nutrition/{uid}/meta/catalog, nutrition/{uid}/logs/{date},
 *              nutrition/public/meta/micros, knowledge_tasks/{id}
 */

import {
  doc, getDoc, setDoc, collection, query, where, getDocs,
  orderBy, limit, documentId, serverTimestamp, writeBatch,
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

export async function getNutritionLog(date = todayISO()) {
  const snap = await getDoc(doc(db, "nutrition", getUid(), "logs", date));
  return snap.exists() ? snap.data() : { date, meals: [], water_ml: 0 };
}

export async function saveNutritionLog(date, data) {
  await setDoc(doc(db, "nutrition", getUid(), "logs", date), {
    ...data,
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
  const q = query(
    collection(db, "nutrition", getUid(), "logs"),
    orderBy(documentId(), "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ date: d.id, ...d.data() }))
    .filter(log => (log.meals || []).length > 0);
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
    const dayTotals = zeroMicros();

    for (const meal of log.meals || []) {
      const catalogEntry = catalog.find(i => (meal.catalog_id && i.id === meal.catalog_id) || i.name === meal.description);
      const lookupName = catalogEntry?.name || meal.description;
      const micros = microsMap[lookupName];

      if (micros) {
        let factor = 1;
        if (meal.kcal && micros.kcal) {
          factor = meal.kcal / micros.kcal;
        }

        for (const k of MICRO_KEYS) {
          dayTotals[k] = Math.round((dayTotals[k] + ((micros[k] || 0) * factor)) * 10) / 10;
        }
      } else {
        missingMeals.add(lookupName);
      }
    }

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

  return { ok: true, year, week, dates, week_totals: weekTotals, rda_comparison, day_breakdown: dayBreakdown };
}
