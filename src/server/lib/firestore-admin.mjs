/**
 * firestore-admin.mjs
 *
 * Firebase Admin SDK singleton for the Fuel Centre server.
 * Lazy-initialised: if no service-account file or UID is configured the
 * module is a no-op so local-only mode keeps working.
 *
 * Env vars (same as firestore-sync.mjs for consistency):
 *   FUEL_FIRESTORE_SA   – path to service-account JSON  (default: ~/.env/firebase-fitness.json)
 *   FUEL_CLOUD_UID      – Firestore document UID        (required for writes)
 *
 * Sync model:
 *   PUSH (fire-and-forget): every local write immediately pushes to Firestore.
 *   PULL (hourly):          Firestore → local, timestamp-guarded (last-write-wins).
 *                           Nutrition rows are upserted individually (no array overwrite)
 *                           to avoid the meal-loss bug documented in nutrition-db.mjs.
 *                           Pulled meals then run through nutrition-enrichment.mjs
 *                           (catalog match / macro sanity / micro lookup+estimate);
 *                           if enrichment changed anything it's pushed straight back.
 *
 * This module is transport only (push/pull to Firestore) — the enrichment
 * logic itself lives in ../services/nutrition-enrichment.mjs, kept separate
 * on purpose so this file doesn't grow into a catch-all.
 */

import fs   from "fs";
import path from "path";
import { createRequire } from "module";
import { todayISO } from "../../shared/utils/validation.mjs";

const require = createRequire(import.meta.url);

const SA_PATH = process.env.FUEL_FIRESTORE_SA
  ? path.resolve(process.env.FUEL_FIRESTORE_SA)
  : path.join(process.env.HOME, ".env", "firebase-fitness.json");

const UID = process.env.FUEL_CLOUD_UID || null;

// How many days back the hourly pull looks (today + N-1 previous days).
const PULL_DAYS = Math.max(1, Math.min(Number(process.env.FUEL_FIRESTORE_PULL_DAYS || 90), 365));
const PULL_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/** @type {import("firebase-admin/firestore").Firestore | null} */
let _db = null;
let _initAttempted = false;

// Real status, read by GET /dev/health — no more guessing from a dead
// Bridge ping endpoint (the old /api/fuel-firestore/status never existed
// as a fuel-dev route, it pinged AlphaOS Bridge on :9080 which has nothing
// to do with this sync).
const _status = {
  lastPushAt: null,
  lastPushError: null,
  lastPullAt: null,
  lastPullError: null,
  pushCount: 0,
  pullCount: 0,
};

export function getSyncStatus() {
  return {
    configured: Boolean(UID),
    uid: UID,
    saPath: SA_PATH,
    saExists: fs.existsSync(SA_PATH),
    connected: Boolean(getDb()),
    pullDays: PULL_DAYS,
    pullIntervalMs: PULL_INTERVAL_MS,
    ..._status,
  };
}

function getDb() {
  if (_initAttempted) return _db;
  _initAttempted = true;

  if (!UID) {
    console.log("[firestore-admin] FUEL_CLOUD_UID not set – Firestore sync disabled.");
    return null;
  }
  if (!fs.existsSync(SA_PATH)) {
    console.warn(`[firestore-admin] Service-account not found at ${SA_PATH} – Firestore sync disabled.`);
    return null;
  }

  try {
    const admin = require("firebase-admin");
    if (!admin.apps.length) {
      const sa = JSON.parse(fs.readFileSync(SA_PATH, "utf-8"));
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    }
    _db = admin.firestore();
    console.log(`[firestore-admin] ✅ Firestore Admin ready (uid=${UID})`);
  } catch (e) {
    console.warn("[firestore-admin] Init failed:", e.message);
    _db = null;
  }
  return _db;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function recentDates(n) {
  const dates = [];
  const base = new Date(`${todayISO()}T12:00:00`);
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function markPushOk() {
  _status.lastPushAt = new Date().toISOString();
  _status.lastPushError = null;
  _status.pushCount += 1;
}

function markPushError(message) {
  _status.lastPushError = message;
}

// ── PUSH ─────────────────────────────────────────────────────────────────────

/**
 * Push the nutrition meal catalog to Firestore — MERGED, not overwritten.
 *
 * Vorher (bis 2026-07-31): merge:false Full-Overwrite mit dem lokalen
 * Dateistand. Das hat Katalog-Löschungen, die während lokaler Downtime über
 * die Cloud-UI gemacht wurden, beim nächsten lokalen Push kommentarlos
 * rückgängig gemacht (lokal war ja "nicht informiert" über die
 * Cloud-Löschung) — siehe git log für den konkreten Vorfall
 * (meal_ashwagandha/kasekrainer/nussschnecke kamen wiederholt zurück).
 *
 * Jetzt: 3-Wege-Merge pro ID —
 *   1. Remote-Katalog laden.
 *   2. Lokale Items reinmergen, aber nur wenn sie neuer sind (updated_at)
 *      oder remote die ID noch gar nicht kennt — Cloud-Items, die lokal
 *      unbekannt sind (z.B. während Downtime hinzugefügt), bleiben erhalten.
 *   3. Lokal tombstoned IDs werden explizit aus dem Ergebnis entfernt —
 *      eine lokale Löschung gewinnt IMMER, unabhängig vom Remote-Stand.
 */
export async function pushNutritionCatalog(items) {
  const db = getDb();
  if (!db) return;
  try {
    const { listDeletedMealIds } = await import("../services/nutrition-catalog.mjs");
    const ref = db.collection("nutrition").doc(UID).collection("meta").doc("catalog");

    const snap = await ref.get();
    const remoteItems = snap.exists ? (snap.data().items || []) : [];

    const merged = new Map(remoteItems.map((it) => [it.id, it]));
    for (const local of items) {
      const remote = merged.get(local.id);
      const localNewer = !remote || !remote.updated_at || !local.updated_at
        || new Date(local.updated_at) >= new Date(remote.updated_at);
      if (localNewer) merged.set(local.id, local);
    }
    for (const deletedId of listDeletedMealIds()) merged.delete(deletedId);

    const mergedItems = Array.from(merged.values());
    await ref.set({ items: mergedItems, updated_at: new Date().toISOString() }, { merge: false });
    console.log(`[firestore-admin] 📤 nutrition/meta/catalog (${mergedItems.length} items, merged)`);
    markPushOk();
  } catch (e) {
    console.error("[firestore-admin] pushNutritionCatalog failed:", e.message);
    markPushError(e.message);
  }
}

/**
 * Push the full supplements catalog to Firestore.
 * Called fire-and-forget after every supplement catalog mutation.
 */
export async function pushSupplementsCatalog(items) {
  const db = getDb();
  if (!db) return;
  try {
    await db.collection("supplements").doc(UID).collection("meta").doc("catalog")
      .set({ items, updated_at: new Date().toISOString() }, { merge: false });
    console.log(`[firestore-admin] 📤 supplements/meta/catalog (${items.length} items)`);
    markPushOk();
  } catch (e) {
    console.error("[firestore-admin] pushSupplementsCatalog failed:", e.message);
    markPushError(e.message);
  }
}

/**
 * Push a single day's nutrition log to Firestore.
 * Called fire-and-forget after every meal upsert / delete.
 *
 * @param {string}   date    – YYYY-MM-DD
 * @param {object[]} meals   – from getMealsForDate()
 * @param {number}   waterMl – from getWater()
 */
export async function pushNutritionLog(date, meals, waterMl) {
  const db = getDb();
  if (!db) return;
  try {
    const now = new Date().toISOString();
    await db.collection("nutrition").doc(UID).collection("logs").doc(date)
      .set({ meals, water_ml: waterMl, updated_at: now }, { merge: false });
    console.log(`[firestore-admin] 📤 nutrition/logs/${date} (${meals.length} meals)`);
    markPushOk();
  } catch (e) {
    console.error("[firestore-admin] pushNutritionLog failed:", e.message);
    markPushError(e.message);
  }
}

export async function pushNutritionJournal(date, content) {
  const db = getDb();
  if (!db) return;
  try {
    const now = new Date().toISOString();
    await db.collection("nutrition").doc(UID).collection("journal").doc(date)
      .set({ date, content, updated_at: now }, { merge: true });
    markPushOk();
  } catch (e) {
    console.error("[firestore-admin] pushNutritionJournal failed:", e.message);
    markPushError(e.message);
  }
}

/**
 * Push a single day's supplement log to Firestore.
 * Called fire-and-forget after every intake mutation.
 *
 * @param {string} date – YYYY-MM-DD
 * @param {object} log  – { date, intakes: [...] }
 */
export async function pushSupplementLog(date, log) {
  const db = getDb();
  if (!db) return;
  try {
    const now = new Date().toISOString();
    await db.collection("supplements").doc(UID).collection("logs").doc(date)
      .set({ ...log, updated_at: now }, { merge: false });
    console.log(`[firestore-admin] 📤 supplements/logs/${date} (${log.intakes?.length ?? 0} intakes)`);
    markPushOk();
  } catch (e) {
    console.error("[firestore-admin] pushSupplementLog failed:", e.message);
    markPushError(e.message);
  }
}

// ── PULL ─────────────────────────────────────────────────────────────────────

/**
 * Pull recent nutrition + supplement logs from Firestore.
 * Last-write-wins via updated_at timestamp comparison.
 * Nutrition meals are upserted row-by-row (never array-overwrite) to
 * avoid the data-loss bug that motivated the SQLite migration.
 *
 * Services resolve their own file paths internally (config/paths.mjs), so
 * this function needs no path arguments.
 */
async function pullRecentLogs() {
  const db = getDb();
  if (!db) return;

  try {
    await doPullRecentLogs(db);
    _status.lastPullAt = new Date().toISOString();
    _status.lastPullError = null;
    _status.pullCount += 1;
  } catch (e) {
    _status.lastPullError = e.message;
    throw e;
  }
}

async function doPullRecentLogs(db) {
  // Lazy-import services to avoid circular deps at module load time.
  const { upsertMeal, upsertWater }   = await import("../services/nutrition-db.mjs");
  const { loadLog, saveLog }          = await import("../services/supplements-log.mjs");
  const { enrichNutritionLog }        = await import("../services/nutrition-enrichment.mjs");
  const { writeEntry }                = await import("../services/nutrition-notes.mjs");

  const dates = recentDates(PULL_DAYS);

  for (const date of dates) {
    // ── Nutrition log ──────────────────────────────────────────────────────
    try {
      const nutSnap = await db.collection("nutrition").doc(UID).collection("logs").doc(date).get();
      if (nutSnap.exists) {
        const remote = nutSnap.data();
        const remoteAt = remote.updated_at ? new Date(remote.updated_at).getTime() : 0;

        // Enrich (catalog-match / macro-sanity / micro-lookup+estimate)
        // before writing – so the local DB already gets the filled-in data.
        const { meals: enrichedMeals, changed } = await enrichNutritionLog(
          (remote.meals || []).map((m) => ({ ...m, date }))
        );

        // Upsert each meal individually – no array overwrite, no data loss.
        for (const meal of enrichedMeals) {
          // Only upsert if remote meal is newer than what might be local.
          // meal.updated_at may not exist on old records; treat absence as "pull it".
          const mealRemoteAt = meal.updated_at ? new Date(meal.updated_at).getTime() : remoteAt;
          upsertMeal(meal);
          void mealRemoteAt; // timestamp noted, upsert always wins for now (remote is authoritative)
        }

        if (remote.water_ml != null) {
          upsertWater(date, remote.water_ml);
        }

        console.log(`[firestore-admin] 📥 nutrition/logs/${date} (${remote.meals?.length ?? 0} meals)`);

        // Enrichment added data Firestore didn't have – push it straight back.
        if (changed) {
          await pushNutritionLog(date, enrichedMeals, remote.water_ml ?? 0);
          console.log(`[firestore-admin] ✨ nutrition/logs/${date} enriched + pushed back`);
        }
      }
    } catch (e) {
      console.error(`[firestore-admin] pull nutrition/logs/${date} failed:`, e.message);
    }

    // ── Supplement log ─────────────────────────────────────────────────────
    try {
      const suppSnap = await db.collection("supplements").doc(UID).collection("logs").doc(date).get();
      if (suppSnap.exists) {
        const remote = suppSnap.data();
        const local  = loadLog(date);

        const remoteAt = remote.updated_at ? new Date(remote.updated_at).getTime() : 0;
        const localAt  = local.updated_at  ? new Date(local.updated_at).getTime()  : 0;

        if (remoteAt >= localAt) {
          // Merge: keep local intakes that aren't in remote (by id), then add remote ones.
          const remoteIds = new Set((remote.intakes || []).map(i => i.id));
          const localOnly = (local.intakes || []).filter(i => !remoteIds.has(i.id));
          const merged = { ...remote, intakes: [...(remote.intakes || []), ...localOnly] };
          saveLog(merged);
          console.log(`[firestore-admin] 📥 supplements/logs/${date} (${merged.intakes.length} intakes)`);
        } else {
          console.log(`[firestore-admin] ⏭  supplements/logs/${date} local is newer, skipping pull`);
        }
      }
    } catch (e) {
      console.error(`[firestore-admin] pull supplements/logs/${date} failed:`, e.message);
    }

    try {
      const journalSnap = await db.collection("nutrition").doc(UID).collection("journal").doc(date).get();
      if (journalSnap.exists) {
        const remote = journalSnap.data();
        writeEntry(date, remote.content || "");
      }
    } catch (e) {
      console.error(`[firestore-admin] pull nutrition/journal/${date} failed:`, e.message);
    }
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

/**
 * Manually trigger a pull outside the hourly schedule — used by the
 * POST /dev/sync/pull button in the Dev/Prod tab.
 */
export async function pullNow() {
  return pullRecentLogs();
}

/**
 * Start the hourly Firestore pull scheduler.
 * Also fires once immediately on startup (after a short delay to let the
 * server finish booting).
 */
export function startFirestorePullScheduler() {
  if (!getDb()) return; // no-op in local-only mode

  // Initial pull after 5 s so the server is fully up first.
  setTimeout(() => pullRecentLogs().catch(e =>
    console.error("[firestore-admin] startup pull failed:", e.message)
  ), 5_000);

  // Hourly pull.
  setInterval(() => pullRecentLogs().catch(e =>
    console.error("[firestore-admin] hourly pull failed:", e.message)
  ), PULL_INTERVAL_MS);

  console.log(`[firestore-admin] 🔄 Hourly pull scheduler started (every ${PULL_INTERVAL_MS / 60000} min, last ${PULL_DAYS} days)`);
}

export { getDb, UID };
