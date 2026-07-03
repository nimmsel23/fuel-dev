import { g as getDoc, d as doc, a as db, b as getDocs, q as query, w as where, c as collection, s as setDoc, e as auth, o as onAuthStateChanged, f as signOut$1, h as signInWithPopup, i as googleProvider, j as serverTimestamp, l as limit, k as orderBy } from './firebase-D9PLc3IU.js';

const scriptRel = 'modulepreload';const assetsURL = function(dep) { return "/"+dep };const seen = {};const __vitePreload = function preload(baseModule, deps, importerUrl) {
  let promise = Promise.resolve();
  if (true && deps && deps.length > 0) {
    document.getElementsByTagName("link");
    const cspNonceMeta = document.querySelector(
      "meta[property=csp-nonce]"
    );
    const cspNonce = cspNonceMeta?.nonce || cspNonceMeta?.getAttribute("nonce");
    promise = Promise.allSettled(
      deps.map((dep) => {
        dep = assetsURL(dep);
        if (dep in seen) return;
        seen[dep] = true;
        const isCss = dep.endsWith(".css");
        const cssSelector = isCss ? '[rel="stylesheet"]' : "";
        if (document.querySelector(`link[href="${dep}"]${cssSelector}`)) {
          return;
        }
        const link = document.createElement("link");
        link.rel = isCss ? "stylesheet" : scriptRel;
        if (!isCss) {
          link.as = "script";
        }
        link.crossOrigin = "";
        link.href = dep;
        if (cspNonce) {
          link.setAttribute("nonce", cspNonce);
        }
        document.head.appendChild(link);
        if (isCss) {
          return new Promise((res, rej) => {
            link.addEventListener("load", res);
            link.addEventListener(
              "error",
              () => rej(new Error(`Unable to preload CSS for ${dep}`))
            );
          });
        }
      })
    );
  }
  function handlePreloadError(err) {
    const e = new Event("vite:preloadError", {
      cancelable: true
    });
    e.payload = err;
    window.dispatchEvent(e);
    if (!e.defaultPrevented) {
      throw err;
    }
  }
  return promise.then((res) => {
    for (const item of res || []) {
      if (item.status !== "rejected") continue;
      handlePreloadError(item.reason);
    }
    return baseModule().catch(handlePreloadError);
  });
};

// ── Auth ──────────────────────────────────────────────────────────────────────

function watchAuth(callback) {
  return onAuthStateChanged(auth, (user) => {
    console.log(`[Auth] User status changed: ${user ? user.email : "logged out"}`);
    callback(user);
  });
}

async function signIn() {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Login Fehler:", error);
    throw error;
  }
}

async function signOut() {
  try {
    await signOut$1(auth);
  } catch (error) {
    console.error("Logout Fehler:", error);
    throw error;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getUid() {
  if (!auth.currentUser) throw new Error("User not authenticated");
  return auth.currentUser.uid;
}

const MICRO_KEYS = [
  "vitamin_a_ug", "vitamin_d_ug", "vitamin_e_mg", "vitamin_k_ug",
  "vitamin_c_mg", "vitamin_b1_mg", "vitamin_b2_mg", "vitamin_b3_mg",
  "vitamin_b5_mg", "vitamin_b6_mg", "vitamin_b7_ug", "folate_ug", "vitamin_b12_ug",
  "calcium_mg", "phosphorus_mg", "magnesium_mg", "iron_mg", "zinc_mg",
  "selenium_ug", "iodine_ug", "potassium_mg", "sodium_mg",
  "omega3_mg",
];

function zeroMicros() {
  return Object.fromEntries(MICRO_KEYS.map((k) => [k, 0]));
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

// ── Nutrition ─────────────────────────────────────────────────────────────────

async function getNutritionCatalog() {
  const ref = doc(db, "nutrition", getUid(), "meta", "catalog");
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().items || []) : [];
}

async function getMicrosCatalog() {
  const ref = doc(db, "nutrition", "public", "meta", "micros");
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().items || []) : [];
}

async function getNutritionLog(date = todayISO()) {
  const snap = await getDoc(doc(db, "nutrition", getUid(), "logs", date));
  return snap.exists() ? snap.data() : { date, meals: [], water_ml: 0 };
}

async function saveNutritionLog(date, data) {
  await setDoc(doc(db, "nutrition", getUid(), "logs", date), {
    ...data,
    updated_at: serverTimestamp(),
  }, { merge: true });
}

async function getNutritionLogsInRange(dates) {
  const q = query(
    collection(db, "nutrition", getUid(), "logs"),
    where("date", "in", dates)
  );
  const snap = await getDocs(q);
  const map = {};
  snap.forEach(d => { map[d.id] = d.data(); });
  return map;
}

async function searchNutritionCatalog(q, limit = 20) {
  const items = await getNutritionCatalog();
  const lowerQ = q.toLowerCase();
  return items
    .filter(i => i.name.toLowerCase().includes(lowerQ))
    .slice(0, limit);
}

async function getWeeklyMicros(year, week) {
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

  for (const date of dates) {
    const log = logsMap[date] || { meals: [] };
    const dayTotals = zeroMicros();

    for (const meal of log.meals || []) {
      const catalogEntry = catalog.find(i => (meal.catalog_id && i.id === meal.catalog_id) || i.name === meal.description);
      const lookupName = catalogEntry?.name || meal.description;
      const micros = microsMap[lookupName];

      if (micros) {
        for (const k of MICRO_KEYS) {
          dayTotals[k] = Math.round((dayTotals[k] + (micros[k] || 0)) * 10) / 10;
        }
      }
    }

    const suppLog = suppLogsMap[date] || { intakes: [] };
    for (const intake of suppLog.intakes || []) {
      const entry = suppCatalogMap[intake.supplement_id];
      if (entry?.micros) {
        for (const k of MICRO_KEYS) {
          if (entry.micros[k]) {
            dayTotals[k] = Math.round((dayTotals[k] + entry.micros[k]) * 10) / 10;
          }
        }
      }
    }
    for (const k of MICRO_KEYS) {
      weekTotals[k] = Math.round((weekTotals[k] + dayTotals[k]) * 10) / 10;
    }
  }

  // Comparison logic is handled by the caller or we can import it, but shared/config/dach.mjs is ESM
  // Since we are in the client, we can just import it.
  const { DACH, getStatus } = await __vitePreload(async () => { const { DACH, getStatus } = await import('./dach-CCrdr_-R.js');return { DACH, getStatus }},true?[]:void 0);
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

  return { ok: true, year, week, dates, week_totals: weekTotals, rda_comparison, day_breakdown };
}

// ── Journal ───────────────────────────────────────────────────────────────────

async function getJournal(date = todayISO()) {
  const snap = await getDoc(doc(db, "nutrition", getUid(), "journal", date));
  return snap.exists() ? snap.data().content : "";
}

async function saveJournal(date = todayISO(), content) {
  await setDoc(doc(db, "nutrition", getUid(), "journal", date), {
    date,
    content,
    updated_at: serverTimestamp(),
  });
}

// ── Supplements ───────────────────────────────────────────────────────────────

async function getSupplementsCatalog() {
  const ref = doc(db, "supplements", getUid(), "meta", "catalog");
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().items || []) : [];
}

async function getSupplementLog(date = todayISO()) {
  const snap = await getDoc(doc(db, "supplements", getUid(), "logs", date));
  return snap.exists() ? snap.data() : { date, intakes: [] };
}

async function getSupplementStats(anchorDate, days = 30) {
  const anchor = new Date(anchorDate);
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });

  const snap = await getDocs(query(collection(db, "supplements", getUid(), "logs"), orderBy("date", "desc"), limit(days)));
  const logsMap = {};
  snap.forEach(doc => { logsMap[doc.id] = doc.data(); });

  const catalog = await getSupplementsCatalog();
  const stats = {};

  // Initialize stats from intakes found in logs
  Object.values(logsMap).forEach(log => {
    (log.intakes || []).forEach(intake => {
      const suppId = intake.supplement_id;
      if (!stats[suppId]) {
        const catalogItem = catalog.find(i => i.id === suppId);
        stats[suppId] = {
          supplement: catalogItem || { id: suppId, name: intake.name || suppId },
          days_taken: 0,
          current_streak: 0,
        };
      }
      stats[suppId].days_taken += 1;
    });
  });

  // Calculate streaks
  const todayStr = todayISO();
  for (const suppId in stats) {
    let streak = 0;
    for (const dateStr of dates) {
      const log = logsMap[dateStr];
      const hasIntake = log && (log.intakes || []).some(i => i.supplement_id === suppId);
      if (hasIntake) {
        streak += 1;
      } else if (dateStr === todayStr) {
        continue; // Don't break streak if today isn't logged yet
      } else {
        break;
      }
    }
    stats[suppId].current_streak = streak;
  }

  return { ok: true, anchor: anchorDate, days, stats: Object.values(stats) };
}

const isCloud = () => {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  // Auf web.app oder firebaseapp.com sind wir definitiv in der Cloud
  if (host.includes("web.app") || host.includes("firebaseapp.com")) return true;
  // Falls wir lokal arbeiten (localhost / 127.0.0.1), sind wir NICHT in der Cloud
  if (host === "localhost" || host === "127.0.0.1") return false;
  // Falls wir über die Tailscale URL aufrufen, wollen wir NICHT in den Cloud Modus,
  // sondern das lokale Backend nutzen
  if (host.includes("ts.net")) return false;
  // Standard lokal
  return false;
};

function normalizePath(path) {
  // Entferne /api Präfix falls vorhanden für das Matching
  return path.startsWith("/api/") ? path.slice(4) : path;
}

async function searchOFF(query, limit) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=${limit}`;
  try {
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.products || [])
      .filter((p) => p.product_name && p.nutriments?.["energy-kcal_100g"] != null)
      .map((p) => ({
        name: p.product_name,
        brand: p.brands || "",
        kcal: Math.round((p.nutriments["energy-kcal_100g"] ?? 0) * 10) / 10,
        kh: Math.round((p.nutriments.carbohydrates_100g ?? 0) * 10) / 10,
        fett: Math.round((p.nutriments.fat_100g ?? 0) * 10) / 10,
        ew: Math.round((p.nutriments.proteins_100g ?? 0) * 10) / 10,
        _src: "off",
      }));
  } catch (err) {
    console.error("OFF search error:", err);
    return [];
  }
}

async function fetchJson(path) {
  const normPath = normalizePath(path);

  if (isCloud()) {
    // Map paths to Firestore functions
    if (normPath.startsWith("/nutrition/log")) {
      const url = new URL(path, window.location.origin);
      const date = url.searchParams.get("date");
      return { data: await getNutritionLog(date) };
    }
    if (normPath === "/nutrition/catalog") {
      return { items: await getNutritionCatalog() };
    }
    if (normPath.startsWith("/nutrition/journal")) {
      const url = new URL(path, window.location.origin);
      const date = url.searchParams.get("date");
      return { content: await getJournal(date) };
    }
    if (normPath.startsWith("/supplements/catalog")) {
      return { items: await getSupplementsCatalog() };
    }
    if (normPath.startsWith("/supplements/log")) {
      const url = new URL(path, window.location.origin);
      const date = url.searchParams.get("date");
      return { data: await getSupplementLog(date) };
    }
    if (normPath.startsWith("/nutrition/search")) {
      const url = new URL(path, window.location.origin);
      const q = url.searchParams.get("q");
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const [catalogResults, offResults] = await Promise.all([
        searchNutritionCatalog(q, limit),
        searchOFF(q, limit)
      ]);
      const results = [...catalogResults, ...offResults];
      return { ok: true, count: results.length, results };
    }
    if (normPath.startsWith("/nutrition/weekly")) {
      const parts = normPath.split("/");
      const year = parseInt(parts[parts.length - 2]);
      const week = parseInt(parts[parts.length - 1]);
      return await getWeeklyMicros(year, week);
    }
    if (normPath === "/api/fuel-firestore/status") {
      return { ok: true, firestore: "connected", mode: "native-cloud" };
    }
    if (normPath === "/health") {
      return { status: "ok", mode: "native-cloud" };
    }
  }

  const res = await fetch(path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function deleteJson(path) {
  const normPath = normalizePath(path);

  if (isCloud()) {
    if (normPath.startsWith("/nutrition/catalog/")) {
      const id = normPath.split("/").pop();
      const items = await getNutritionCatalog();
      const filtered = items.filter((i) => i.id !== id);
      const ref = doc(db, "nutrition", getUid(), "meta", "catalog");
      await setDoc(ref, { items: filtered, updated_at: serverTimestamp() });
      return { ok: true };
    }
  }

  const res = await fetch(path, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function patchJson(path, body) {
  const normPath = normalizePath(path);

  if (isCloud()) {
    if (normPath === "/nutrition/log") {
      const existing = await getNutritionLog(body.date);
      const meals = [...(existing.meals || [])];
      const idx = meals.findIndex((m) => m.id === body.meal_id);
      if (idx !== -1) {
        if (body.new_date && body.new_date !== body.date) {
          const movedMeal = { ...meals[idx], ...body.meal, id: body.meal_id };
          meals.splice(idx, 1);
          await saveNutritionLog(body.date, { ...existing, meals });
          const targetLog = await getNutritionLog(body.new_date);
          targetLog.meals = [...(targetLog.meals || []), movedMeal];
          await saveNutritionLog(body.new_date, targetLog);
        } else {
          meals[idx] = { ...meals[idx], ...body.meal };
          await saveNutritionLog(body.date, { ...existing, meals });
        }
      }
      return { ok: true };
    }
  }

  const res = await fetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function postJson(path, body) {
  const normPath = normalizePath(path);

  if (isCloud()) {
    if (normPath === "/nutrition/log") {
      const existing = await getNutritionLog(body.date);
      if (body.delete_meal_id) {
        existing.meals = (existing.meals || []).filter((m) => m.id !== body.delete_meal_id);
      } else if (body.catalog_item_id) {
        const catalog = await getNutritionCatalog();
        const item = catalog.find((i) => i.id === body.catalog_item_id);
        if (item) {
          const meal = {
            id: `meal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
            type: item.meal_type || item.type || "meal",
            description: item.name || item.description,
            notes: item.notes || "",
            kcal: item.kcal || 0,
            protein: item.protein || 0,
            carbs: item.carbs || 0,
            fat: item.fat || 0,
            catalog_id: item.id,
            logged_at: new Date().toISOString(),
          };
          existing.meals = [...(existing.meals || []), meal];
        }
      } else if (body.meal) {
        const meal = {
          ...body.meal,
          id: body.meal.id || `meal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          logged_at: body.meal.logged_at || new Date().toISOString(),
        };
        existing.meals = [...(existing.meals || []), meal];
      }
      await saveNutritionLog(body.date, existing);
      return { ok: true };
    }
    if (normPath === "/nutrition/journal") {
      await saveJournal(body.date, body.content);
      return { ok: true };
    }
    if (normPath === "/nutrition/catalog") {
      const items = await getNutritionCatalog();
      const item = { ...body.item, id: body.item.id || `meal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}` };
      items.push(item);
      const ref = doc(db, "nutrition", getUid(), "meta", "catalog");
      await setDoc(ref, { items, updated_at: serverTimestamp() });
      return { ok: true, item };
    }
    if (normPath === "/supplements/log") {
      // Wenn es ein delete_id gibt, löschen wir, sonst speichern wir
      const existing = await getSupplementLog(body.date);
      if (body.delete_id) {
        existing.intakes = (existing.intakes || []).filter(i => i.id !== body.delete_id);
      } else {
        const intake = { ...body.intake, id: `supp_${Date.now()}` };
        existing.intakes = [...(existing.intakes || []), intake];
      }
      const ref = doc(db, "supplements", getUid(), "logs", body.date);
      await setDoc(ref, { ...existing, updated_at: serverTimestamp() });
      return { ok: true };
    }
  }

  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // keep fallback
    }
    throw new Error(message);
  }
  return res.json();
}

export { __vitePreload as _, patchJson as a, signIn as b, getNutritionLogsInRange as c, deleteJson as d, getJournal as e, fetchJson as f, getNutritionLog as g, getSupplementStats as h, getSupplementsCatalog as i, getSupplementLog as j, postJson as p, signOut as s, watchAuth as w };
