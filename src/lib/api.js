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
    if (normPath.startsWith("/supplements/stats")) {
      const url = new URL(path, window.location.origin);
      const date = url.searchParams.get("anchor") || url.searchParams.get("date");
      return await firestore.getSupplementStats(date);
    }
  }

  const res = await fetch(path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function postJson(path, body) {
  const normPath = normalizePath(path);

  if (isCloud()) {
    if (normPath === "/nutrition/log") {
      await firestore.saveNutritionLog(body.date, body.meal ? { meals: [body.meal] } : body);
      return { ok: true };
    }
    if (normPath === "/nutrition/journal") {
      await firestore.saveJournal(body.date, body.content);
      return { ok: true };
    }
    if (normPath === "/nutrition/catalog") {
      const items = await firestore.getNutritionCatalog();
      items.push(body.item);
      const ref = doc(firestore.db, "nutrition", firestore.getUid(), "meta", "catalog");
      await setDoc(ref, { items, updated_at: firestore.serverTimestamp() });
      return { ok: true };
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
