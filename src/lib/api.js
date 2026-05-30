import * as firestore from "./firestore-db.js";
import { doc, setDoc } from "firebase/firestore";

const isCloud = () => typeof window !== "undefined" && (window.location.hostname.includes("web.app") || window.location.hostname.includes("firebaseapp.com"));

export async function fetchJson(path) {
  if (isCloud()) {
    // Map paths to Firestore functions
    if (path.startsWith("/nutrition/log")) {
      const url = new URL(path, window.location.origin);
      const date = url.searchParams.get("date");
      return { data: await firestore.getNutritionLog(date) };
    }
    if (path === "/nutrition/catalog") {
      return { items: await firestore.getNutritionCatalog() };
    }
    if (path.startsWith("/nutrition/journal")) {
      const url = new URL(path, window.location.origin);
      const date = url.searchParams.get("date");
      return { content: await firestore.getJournal(date) };
    }
    if (path.startsWith("/supplements/catalog")) {
      return { items: await firestore.getSupplementsCatalog() };
    }
    if (path.startsWith("/supplements/log")) {
      const url = new URL(path, window.location.origin);
      const date = url.searchParams.get("date");
      return { data: await firestore.getSupplementLog(date) };
    }
    if (path.startsWith("/supplements/stats")) {
      const url = new URL(path, window.location.origin);
      const date = url.searchParams.get("anchor");
      return await firestore.getSupplementStats(date);
    }
  }

  const res = await fetch(path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function postJson(path, body) {
  if (isCloud()) {
    if (path === "/nutrition/log") {
      await firestore.saveNutritionLog(body.date, body.meal ? { meals: [body.meal] } : body);
      return { ok: true };
    }
    if (path === "/nutrition/journal") {
      await firestore.saveJournal(body.date, body.content);
      return { ok: true };
    }
    if (path === "/nutrition/catalog") {
      // In der Cloud koennen wir den Katalog theoretisch auch updaten, 
      // aber primär sollte er vom Laptop kommen.
      // Wir implementieren es hier trotzdem fuer Konsistenz.
      const items = await firestore.getNutritionCatalog();
      items.push(body.item);
      const ref = doc(firestore.db, "nutrition", firestore.getUid(), "meta", "catalog");
      await setDoc(ref, { items, updated_at: firestore.serverTimestamp() });
      return { ok: true };
    }
    // TODO: Add more mappings as needed
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
