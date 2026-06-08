import * as firestore from "./firestore-db.js";
import { doc, setDoc } from "firebase/firestore";

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

export async function fetchJson(path) {
  const normPath = normalizePath(path);

  if (isCloud()) {
    // Map paths to Firestore functions
    if (normPath.startsWith("/nutrition/log")) {
      const url = new URL(path, window.location.origin);
      const date = url.searchParams.get("date");
      return { data: await firestore.getNutritionLog(date) };
    }
    if (normPath === "/nutrition/catalog") {
      return { items: await firestore.getNutritionCatalog() };
    }
    if (normPath.startsWith("/nutrition/journal")) {
      const url = new URL(path, window.location.origin);
      const date = url.searchParams.get("date");
      return { content: await firestore.getJournal(date) };
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
      const results = await firestore.searchNutritionCatalog(q, limit);
      return { ok: true, count: results.length, results };
    }
    if (normPath.startsWith("/nutrition/weekly")) {
      const parts = normPath.split("/");
      const year = parseInt(parts[parts.length - 2]);
      const week = parseInt(parts[parts.length - 1]);
      return await firestore.getWeeklyMicros(year, week);
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

export async function patchJson(path, body) {
  const normPath = normalizePath(path);

  if (isCloud()) {
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
  }

  const res = await fetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function postJson(path, body) {
  const normPath = normalizePath(path);

  if (isCloud()) {
    if (normPath === "/nutrition/log") {
      const existing = await firestore.getNutritionLog(body.date);
      if (body.delete_meal_id) {
        existing.meals = (existing.meals || []).filter((m) => m.id !== body.delete_meal_id);
      } else if (body.catalog_item_id) {
        const catalog = await firestore.getNutritionCatalog();
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
      await firestore.saveNutritionLog(body.date, existing);
      return { ok: true };
    }
    if (normPath === "/nutrition/journal") {
      await firestore.saveJournal(body.date, body.content);
      return { ok: true };
    }
    if (normPath === "/nutrition/catalog") {
      const items = await firestore.getNutritionCatalog();
      const item = { ...body.item, id: body.item.id || `meal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}` };
      items.push(item);
      const ref = doc(firestore.db, "nutrition", firestore.getUid(), "meta", "catalog");
      await setDoc(ref, { items, updated_at: firestore.serverTimestamp() });
      return { ok: true, item };
    }
    if (normPath === "/supplements/log") {
      // Wenn es ein delete_id gibt, löschen wir, sonst speichern wir
      const existing = await firestore.getSupplementLog(body.date);
      if (body.delete_id) {
        existing.intakes = (existing.intakes || []).filter(i => i.id !== body.delete_id);
      } else {
        const intake = { ...body.intake, id: `supp_${Date.now()}` };
        existing.intakes = [...(existing.intakes || []), intake];
      }
      const ref = doc(firestore.db, "supplements", firestore.getUid(), "logs", body.date);
      await setDoc(ref, { ...existing, updated_at: firestore.serverTimestamp() });
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
