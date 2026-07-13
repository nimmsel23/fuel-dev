/**
 * Firestore Supplements — supplements/{uid}/meta/catalog + logs
 */

import {
  doc, getDoc, setDoc, collection, query, getDocs, orderBy, limit, documentId,
} from "firebase/firestore";
import { db } from "../../firebase.js";
import { getUid, serverTimestamp } from "./core.js";
import { todayISO } from "./utils.js";

export async function getSupplementsCatalog() {
  const ref = doc(db, "supplements", getUid(), "meta", "catalog");
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().items || []) : [];
}

export async function deleteSupplementFromCatalog(id) {
  const items = await getSupplementsCatalog();
  const filtered = items.filter((i) => i.id !== id);
  const ref = doc(db, "supplements", getUid(), "meta", "catalog");
  await setDoc(ref, { items: filtered, updated_at: serverTimestamp() });
  return filtered;
}

export async function getSupplementLog(date = todayISO()) {
  const snap = await getDoc(doc(db, "supplements", getUid(), "logs", date));
  return snap.exists() ? snap.data() : { date, intakes: [] };
}

export async function saveSupplementLog(date, data) {
  await setDoc(doc(db, "supplements", getUid(), "logs", date), {
    ...data,
    updated_at: serverTimestamp(),
  }, { merge: true });
}

export async function updateIntakeInLog(date, intakeId, updates) {
  const log = await getSupplementLog(date);
  const intakes = [...(log.intakes || [])];
  const idx = intakes.findIndex((i) => i.id === intakeId);
  if (idx === -1) return null;
  intakes[idx] = { ...intakes[idx], ...updates };
  await saveSupplementLog(date, { ...log, intakes });
  return intakes[idx];
}

export async function getSupplementsHistory(limitCount = 30) {
  const q = query(
    collection(db, "supplements", getUid(), "logs"),
    orderBy(documentId(), "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ date: d.id, ...d.data() }))
    .filter(log => (log.intakes || []).length > 0);
}

export async function getSupplementStats(anchorDate, days = 30) {
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
