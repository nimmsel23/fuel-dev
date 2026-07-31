// Cloud channel — Firestore only. No Fastify/local fetch for data.
import * as firestore from "./db.firestore.js";
import { doc, setDoc } from "firebase/firestore";

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
  if (normPath.startsWith("/nutrition/frames")) {
    const url = new URL(path, window.location.origin);
    const limitCount = parseInt(url.searchParams.get("limit") || "20");
    return { ok: true, frames: await firestore.getFuelFrames(limitCount) };
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

export async function postJson(path, body) {
  const normPath = normalizePath(path);

  if (normPath === "/fuel-firestore/ping") return { ok: true };

  if (normPath === "/nutrition/log") {
    const existing = await firestore.getNutritionLog(body.date);
    if (body.delete_meal_id) {
      existing.meals = (existing.meals || []).filter((m) => m.id !== body.delete_meal_id);
    } else if (body.catalog_item_id) {
      const catalog = await firestore.getNutritionCatalog();
      const item = catalog.find((i) => i.id === body.catalog_item_id);
      if (item) {
        existing.meals = [...(existing.meals || []), {
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
        }];
      }
    } else if (body.meal) {
      existing.meals = [...(existing.meals || []), {
        ...body.meal,
        id: body.meal.id || `meal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        logged_at: body.meal.logged_at || new Date().toISOString(),
      }];
    }
    await firestore.saveNutritionLog(body.date, existing);
    return { ok: true };
  }

  if (normPath === "/nutrition/notes") {
    await firestore.saveNotes(body.date, body.content);
    return { ok: true };
  }

  if (normPath === "/nutrition/frame") {
    const result = await firestore.saveFuelFrame(body.frame);
    return { ok: true, ...result };
  }

  if (normPath === "/nutrition/catalog") {
    const items = await firestore.getNutritionCatalog();
    const normalizeName = (n) => String(n || "").trim().toLowerCase().replace(/\s+/g, " ");
    const inputName = normalizeName(body.item?.name);
    const existingIdx = items.findIndex(
      (i) => (body.item?.id && i.id === body.item.id) || normalizeName(i.name) === inputName
    );
    const item = {
      ...body.item,
      id: (existingIdx >= 0 ? items[existingIdx].id : body.item.id) || `meal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    };
    if (existingIdx >= 0) {
      items[existingIdx] = item;
    } else {
      items.push(item);
    }
    const ref = doc(firestore.db, "nutrition", firestore.getUid(), "meta", "catalog");
    await setDoc(ref, { items, updated_at: firestore.serverTimestamp() });
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
    const existing = await firestore.getSupplementLog(body.date);
    if (body.delete_id) {
      existing.intakes = (existing.intakes || []).filter((i) => i.id !== body.delete_id);
    } else {
      let intake = { ...body.intake };
      if (!intake.name && intake.supplement_id) {
        const catalog = await firestore.getSupplementsCatalog();
        const catalogItem = catalog.find((i) => i.id === intake.supplement_id);
        if (catalogItem) intake.name = catalogItem.name;
      }
      existing.intakes = [...(existing.intakes || []), { ...intake, id: `supp_${Date.now()}` }];
    }
    const ref = doc(firestore.db, "supplements", firestore.getUid(), "logs", body.date);
    await setDoc(ref, { ...existing, updated_at: firestore.serverTimestamp() });
    return { ok: true };
  }

  if (normPath === "/supplements/catalog") {
    const items = await firestore.getSupplementsCatalog();
    const item = { ...body, id: body.id || `supp_${Date.now().toString(36)}` };
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx >= 0) items[idx] = item; else items.push(item);
    const ref = doc(firestore.db, "supplements", firestore.getUid(), "meta", "catalog");
    await setDoc(ref, { items, updated_at: firestore.serverTimestamp() });
    return { ok: true, item };
  }

  throw new Error(`postJson: unmapped cloud path: ${path}`);
}

export async function patchJson(path, body) {
  const normPath = normalizePath(path);

  if (normPath === "/nutrition/log") {
    const existing = await firestore.getNutritionLog(body.date);
    const meals = [...(existing.meals || [])];
    const idx = meals.findIndex((m) => m.id === body.meal_id);
    if (idx !== -1) {
      if (body.new_date && body.new_date !== body.date) {
        const movedMeal = { ...meals[idx], ...body.meal, id: body.meal_id };
        meals.splice(idx, 1);
        await firestore.saveNutritionLog(body.date, { ...existing, meals });
        const targetLog = await firestore.getNutritionLog(body.new_date);
        targetLog.meals = [...(targetLog.meals || []), movedMeal];
        await firestore.saveNutritionLog(body.new_date, targetLog);
      } else {
        meals[idx] = { ...meals[idx], ...body.meal };
        await firestore.saveNutritionLog(body.date, { ...existing, meals });
      }
    }
    return { ok: true };
  }

  if (normPath === "/supplements/log") {
    const updated = await firestore.updateIntakeInLog(body.date, body.intake_id, body.updates || {});
    if (!updated) throw new Error("Intake not found");
    return { ok: true };
  }

  throw new Error(`patchJson: unmapped cloud path: ${path}`);
}

export async function deleteJson(path) {
  const normPath = normalizePath(path);

  if (normPath.startsWith("/nutrition/catalog/")) {
    const id = normPath.split("/").pop();
    const items = await firestore.getNutritionCatalog();
    const filtered = items.filter((i) => i.id !== id);
    const ref = doc(firestore.db, "nutrition", firestore.getUid(), "meta", "catalog");
    await setDoc(ref, { items: filtered, updated_at: firestore.serverTimestamp() });
    return { ok: true };
  }

  if (normPath.startsWith("/supplements/catalog/")) {
    const id = normPath.split("/").pop();
    await firestore.deleteSupplementFromCatalog(id);
    return { ok: true };
  }

  throw new Error(`deleteJson: unmapped cloud path: ${path}`);
}
