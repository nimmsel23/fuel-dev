// Cloud channel — Firestore only. No Fastify/local fetch for data.
import * as firestore from "./db.firestore.js";
import { submitCloudLog } from "./cloudOutbox.js";
import { mutateCloudCatalog } from "./cloudMutations.js";

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

function normalizePath(path) {
  return path.startsWith("/api/") ? path.slice(4) : path;
}

export async function fetchJson(path) {
  const normPath = normalizePath(path);

  if (normPath.startsWith("/nutrition/log")) {
    const url = new URL(path, window.location.origin);
    const date = url.searchParams.get("date");
    return { data: await firestore.getNutritionLog(date) };
  }
  if (normPath === "/nutrition/catalog") {
    return { items: await firestore.getNutritionCatalog() };
  }
  if (normPath.startsWith("/nutrition/history")) {
    const url = new URL(path, window.location.origin);
    const limitCount = parseInt(url.searchParams.get("limit") || "30");
    return { ok: true, history: await firestore.getMealsHistory(limitCount) };
  }
  if (normPath.startsWith("/nutrition/notes")) {
    const url = new URL(path, window.location.origin);
    const date = url.searchParams.get("date");
    return { content: await firestore.getNotes(date) };
  }
  if (normPath.startsWith("/supplements/catalog")) {
    return { items: await firestore.getSupplementsCatalog() };
  }
  if (normPath.startsWith("/supplements/log")) {
    const url = new URL(path, window.location.origin);
    const date = url.searchParams.get("date");
    return { data: await firestore.getSupplementLog(date) };
  }
  if (normPath.startsWith("/nutrition/search")) {
    const url = new URL(path, window.location.origin);
    const q = url.searchParams.get("q");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const [catalogResults, offResults] = await Promise.all([
      firestore.searchNutritionCatalog(q, limit),
      searchOFF(q, limit),
    ]);
    const normalizedCatalog = catalogResults.map(i => ({
      ...i,
      ew: i.protein,
      kh: i.carbs,
      fett: i.fat
    }));
    const results = [...normalizedCatalog, ...offResults];
    return { ok: true, count: results.length, results };
  }
  if (normPath.startsWith("/nutrition/weekly")) {
    const parts = normPath.split("/");
    const year = parseInt(parts[parts.length - 2]);
    const week = parseInt(parts[parts.length - 1]);
    return await firestore.getWeeklyMicros(year, week);
  }
  if (normPath.startsWith("/nutrition/fasting")) {
    const url = new URL(path, window.location.origin);
    const days = parseInt(url.searchParams.get("days") || "14");
    const windows = await firestore.getFastingWindows(days);
    return { ok: true, windows };
  }
  if (normPath === "/fuel-firestore/status" || normPath === "/health") {
    return { ok: true, mode: "cloud" };
  }

  throw new Error(`fetchJson: unmapped cloud path: ${path}`);
}

function normalizeMealName(n) {
  return String(n || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export async function postJson(path, body) {
  const normPath = normalizePath(path);

  if (normPath === "/fuel-firestore/ping") return { ok: true };

  if (normPath === "/nutrition/log") {
    let meal = body.meal;
    if (body.catalog_item_id) {
      const item = (await firestore.getNutritionCatalog()).find(i => i.id === body.catalog_item_id);
      if (!item) throw new Error("Katalogeintrag nicht gefunden.");
      meal = { ...item, id: undefined, description: item.name || item.description,
        type: item.meal_type || "meal", catalog_id: item.id };
    }
    const prepared = meal ? { ...meal,
      id: meal.id || crypto.randomUUID(),
      logged_at: meal.logged_at || meal.time || new Date().toISOString(),
    } : null;
    const result = await submitCloudLog("nutrition", body.date, { ...body, meal: prepared });
    return result;
  }

  if (normPath === "/nutrition/notes") {
    await firestore.saveNotes(body.date, body.content);
    return { ok: true };
  }

  if (normPath === "/nutrition/catalog") {
    const input = { ...body.item, id: body.item?.id || crypto.randomUUID() };
    let item;
    await mutateCloudCatalog("nutrition", items => {
      const idx = items.findIndex(i => i.id === input.id || normalizeMealName(i.name) === normalizeMealName(input.name));
      item = { ...input, id: idx >= 0 ? items[idx].id : input.id };
      if (idx >= 0) items[idx] = item; else items.push(item);
      return items;
    });
    return { ok: true, item };
  }

  if (normPath === "/nutrition/micros") {
    const items = await firestore.getMicrosCatalog();
    // body.items is an array of new micros estimates
    const newItemsMap = new Map(body.items.map(i => [i.meal_name, i]));
    const merged = items.map(i => newItemsMap.has(i.meal_name) ? newItemsMap.get(i.meal_name) : i);
    
    body.items.forEach(newItem => {
      if (!items.find(i => i.meal_name === newItem.meal_name)) {
        merged.push(newItem);
      }
    });

    await firestore.saveMicrosCatalog(merged);
    return { ok: true };
  }

  if (normPath === "/supplements/log") {
    let intake = body.intake ? { ...body.intake } : null;
    if (intake && !intake.name && intake.supplement_id) {
      intake.name = (await firestore.getSupplementsCatalog()).find(i => i.id === intake.supplement_id)?.name || intake.supplement_id;
    }
    if (intake) intake.id = intake.id || crypto.randomUUID();
    return submitCloudLog("supplements", body.date, { ...body, intake }, { background: true });
  }

  if (normPath === "/supplements/catalog") {
    const item = { ...body, id: body.id || crypto.randomUUID() };
    await mutateCloudCatalog("supplements", items => {
      const idx = items.findIndex(i => i.id === item.id);
      if (idx >= 0) items[idx] = item; else items.push(item);
      return items;
    });
    return { ok: true, item };
  }

  throw new Error(`postJson: unmapped cloud path: ${path}`);
}

export async function patchJson(path, body) {
  const normPath = normalizePath(path);

  if (normPath === "/nutrition/log") {
    const sourceMeal = body.new_date ? (await firestore.getNutritionLog(body.date)).meals?.find(m => m.id === body.meal_id) : null;
    return submitCloudLog("nutrition", body.date, {
      ...body, source_meal: sourceMeal || null, move_id: body.new_date ? crypto.randomUUID() : null, meal: body.meal?.time ? { ...body.meal, logged_at: body.meal.time } : body.meal,
    });
  }
  if (normPath === "/supplements/log") {
    return submitCloudLog("supplements", body.date, body);
  }

  throw new Error(`patchJson: unmapped cloud path: ${path}`);
}

export async function deleteJson(path) {
  const normPath = normalizePath(path);

  if (normPath.startsWith("/nutrition/catalog/")) {
    const id = normPath.split("/").pop();
    await mutateCloudCatalog("nutrition", items => items.filter(i => i.id !== id));
    return { ok: true };
  }
  if (normPath.startsWith("/supplements/catalog/")) {
    const id = normPath.split("/").pop();
    await mutateCloudCatalog("supplements", items => items.filter(i => i.id !== id));
    return { ok: true };
  }

  throw new Error(`deleteJson: unmapped cloud path: ${path}`);
}
