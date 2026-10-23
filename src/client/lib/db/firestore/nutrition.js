import { projectCloudLog, outboxEntries, projectCloudCatalog, hasPendingFor } from "../../cloudOutbox.js";
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
import { MICRO_KEYS, zeroMicros, todayISO, getWeekDates, dateToISOWeek } from "./utils.js";
import { mutateCloudLog } from "../../cloudMutations.js";
import { getSupplementsCatalog } from "./supplements.js";
import { DACH, getStatus } from "../../../../shared/config/dach.mjs";

export async function getNutritionCatalog() {
  const ref = doc(db, "nutrition", getUid(), "meta", "catalog");
  let items = [];
  try { const snap = await getDoc(ref); items = snap.exists() ? (snap.data().items || []) : []; }
  catch (error) { if (navigator.onLine || !hasPendingFor("catalog:nutrition")) throw error; }
  return projectCloudCatalog("nutrition", items); // + noch nicht bestätigte Offline-Änderungen
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

// Getilgte Mahlzeiten (deleted_meal_ids im Tages-Dokument) aus der meals-Liste
// entfernen — ein noch nicht konvergierter Merge/Push kann sie wieder in
// meals[] geschrieben haben, der Tombstone ist die autoritative Löschliste.
function applyMealTombstones(data) {
  if (!data || typeof data !== "object") return data;
  const del = Array.isArray(data.deleted_meal_ids) ? data.deleted_meal_ids : [];
  if (del.length && Array.isArray(data.meals)) {
    const set = new Set(del);
    return { ...data, meals: data.meals.filter((m) => !set.has(m?.id)) };
  }
  return data;
}

export async function getNutritionLog(date = todayISO()) {
  let snap;
  try { snap = await getDoc(doc(db, "nutrition", getUid(), "logs", date)); }
  catch (error) {
    if (navigator.onLine || !outboxEntries(getUid()).some(e => e.kind === "nutrition" && e.date === date)) throw error;
    snap = { exists: () => false };
  }
  return projectCloudLog("nutrition", date, snap.exists() ? applyMealTombstones(snap.data()) : { date, meals: [], water_ml: 0 });
}

export async function saveNutritionLog(date, data) {
  const payload = { ...data, updated_at: serverTimestamp() };
  // Mikros-Tages-Cache (siehe getWeeklyMicros) wird ungültig, sobald die
  // Mahlzeiten-Liste angefasst wird — sonst zeigt die Wochenansicht veraltete
  // Summen. Der Cloud-Read berechnet aus aktuellen Einträgen und Katalogen.
  if ("meals" in data) {
    payload.micro_totals = deleteField();
    payload.micro_totals_complete = deleteField();
  }
  await setDoc(doc(db, "nutrition", getUid(), "logs", date), payload, { merge: true });
  if ("meals" in data) {
    void invalidateWeekMicroCache(date).catch(() => {});
  }
}

export async function getNutritionLogsInRange(dates) {
  const uid = getUid();
  const map = {};
  await Promise.all(dates.map(async (date) => {
    const snap = await getDoc(doc(db, "nutrition", uid, "logs", date));
    if (snap.exists()) map[date] = applyMealTombstones(snap.data());
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
      .map(d => applyMealTombstones({ date: d.id, ...d.data() }))
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
  await mutateCloudLog("nutrition", date, { delete_meal_id: mealId });
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

  // 1) Direkt im Katalog-Eintrag hinterlegtes Mikroprofil (Etikett /
  //    Referenztabelle) hat Vorrang vor dem name-gekeyten microsMap-Lookup.
  //    Werte sind absolut für catalogEntry.kcal und werden auf die geloggte
  //    kcal skaliert. Parität zu server/services/nutrition-micros.mjs.
  if (catalogEntry?.micros && Object.keys(catalogEntry.micros).length > 0) {
    const src = catalogEntry.micros;
    let factor = 1;
    if (meal.kcal && catalogEntry.kcal) factor = meal.kcal / catalogEntry.kcal;
    const resolved = {};
    for (const k of MICRO_KEYS) {
      resolved[k] = Math.round((src[k] || 0) * factor * 10) / 10;
    }
    meal.micros = resolved;
    meal.micros_meta = {
      source: catalogEntry.micros_meta?.source || "catalog",
      lookup_name: lookupName || null,
      inferred_from: lookupName || null,
      normalized_key: null,
      scaling_factor: Math.round((factor || 1) * 1000) / 1000,
      resolved_at: new Date().toISOString(),
      origin: "catalog_embedded",
    };
    return resolved;
  }

  // 2) Fallback: separat gepflegtes Micros-Katalog-Item (Gemini-Schätzung).
  const micros = microsMap[lookupName];
  if (!micros) return null;

  let factor = 1;
  if (meal.kcal && micros.kcal) factor = meal.kcal / micros.kcal;

  const resolved = {};
  for (const k of MICRO_KEYS) {
    resolved[k] = Math.round((micros[k] || 0) * factor * 10) / 10;
  }
  meal.micros = resolved;
  meal.micros_meta = {
    source: micros.source || "unknown",
    lookup_name: lookupName || null,
    inferred_from: micros.meal_name || lookupName || null,
    normalized_key: micros.name_key || null,
    scaling_factor: Math.round((factor || 1) * 1000) / 1000,
    resolved_at: new Date().toISOString(),
    origin: "cloud_cache_lookup",
  };
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

// Wochen-Aggregat-Cache — analog zum Tages-Cache (micro_totals). Die
// Summierung über 7 Tage + %DACH-Berechnung ist billig, lief aber bisher bei
// jedem Request neu, weil kein Schreibpfad wusste, welche Woche betroffen
// ist. Ablage als eigenes Sub-Collection-Dokument statt im Log selbst, damit
// die Invalidierung unabhängig von saveNutritionLog() bleibt.
function weekCacheKey(year, week) {
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function weekCacheDocRef(year, week) {
  return doc(db, "nutrition", getUid(), "weekMicrosCache", weekCacheKey(year, week));
}

// Von den Schreibpfaden aufgerufen (saveNutritionLog, Supplement-Log-Writes),
// sobald sich an einem Datum etwas ändert, das in die Wochensumme einfließt.
export async function invalidateWeekMicroCache(dateStr) {
  try {
    const { year, week } = dateToISOWeek(dateStr);
    await setDoc(weekCacheDocRef(year, week), { complete: false }, { merge: true });
  } catch (err) {
    console.error("[week-micros-cache] invalidate failed:", err);
  }
}

export async function getWeeklyMicros(year, week) {
  // Aggregate from current daily documents; a cross-document cache can race
  // with edits while the week is being computed.

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
  const mealBreakdown = {};
  const missingMeals = new Set();

  for (const date of dates) {
    const log = logsMap[date] || { meals: [] };
    // Compute the small seven-day aggregate in memory. Persisting a read-time
    // cache can race with edits and loses the per-meal provenance on cache hits.
    const { totals: mealTotals, missing } = computeMealMicroTotals(log.meals, catalog, microsMap);
    missing.forEach(m => missingMeals.add(m));

    const dayTotals = { ...mealTotals };
    const suppLog = suppLogsMap[date] || { intakes: [] };
    const contributions = (log.meals || [])
      .filter((m) => m.micros)
      .map((m) => ({
        kind: "meal",
        name: m.description,
        kcal: m.kcal || 0,
        micros: m.micros,
        micros_meta: m.micros_meta || null,
      }));
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
        contributions.push({
          kind: "supplement",
          name: entry.name || intake.supplement_id,
          dose: intake.dose,
          unit: entry.unit || "",
          micros: Object.fromEntries(MICRO_KEYS.map((k) => [k, entry.micros[k] ? Math.round((entry.micros[k] * factor) * 10) / 10 : 0])),
          micros_meta: {
            source: "supplement_catalog",
            lookup_name: entry.name || intake.supplement_id,
            inferred_from: intake.supplement_id,
            normalized_key: null,
            scaling_factor: Math.round((factor || 1) * 1000) / 1000,
            resolved_at: new Date().toISOString(),
            origin: "supplement",
          },
        });
      }
    }

    dayBreakdown[date] = dayTotals;
    mealBreakdown[date] = contributions;
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

  const result = { ok: true, year, week, dates, week_totals: weekTotals, rda_comparison, day_breakdown: dayBreakdown, meal_breakdown: mealBreakdown, missing_meals: Array.from(missingMeals) };


  return result;
}

export async function getFastingWindows(days = 14) {
  const { computeFastingWindows } = await import("../../../../shared/utils/fasting.mjs");

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
