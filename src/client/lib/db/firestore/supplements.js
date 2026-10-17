import { summarizeSupplementLogs } from "../../../views/Supplements/stats.js";
import { projectCloudLog, outboxEntries, projectCloudCatalog, hasPendingFor } from "../../cloudOutbox.js";
/**
 * Firestore Supplements — supplements/{uid}/meta/catalog + logs
 */

import {
  doc, getDoc, setDoc, collection, query, getDocs, orderBy, limit, documentId, startAt, endAt,
} from "firebase/firestore";
import { mutateCloudLog, mutateCloudCatalog } from "../../cloudMutations.js";
import { db } from "../../firebase.js";
import { getUid, serverTimestamp } from "./core.js";
import { todayISO } from "./utils.js";
import { invalidateWeekMicroCache } from "./nutrition.js";

export async function getSupplementsCatalog() {
  const ref = doc(db, "supplements", getUid(), "meta", "catalog");
  let items = [];
  try { const snap = await getDoc(ref); items = snap.exists() ? (snap.data().items || []) : []; }
  catch (error) { if (navigator.onLine || !hasPendingFor("catalog:supplements")) throw error; }
  return projectCloudCatalog("supplements", items); // + noch nicht bestätigte Offline-Änderungen
}

export async function deleteSupplementFromCatalog(id) {
  return mutateCloudCatalog("supplements", items => items.filter(i => i.id !== id));
}

export async function getSupplementLog(date = todayISO()) {
  let snap;
  try { snap = await getDoc(doc(db, "supplements", getUid(), "logs", date)); }
  catch (error) {
    if (navigator.onLine || !outboxEntries(getUid()).some(e => e.kind === "supplements" && e.date === date)) throw error;
    snap = { exists: () => false };
  }
  return projectCloudLog("supplements", date, snap.exists() ? snap.data() : { date, intakes: [] });
}

export async function saveSupplementLog(date, data) {
  await setDoc(doc(db, "supplements", getUid(), "logs", date), {
    ...data,
    updated_at: serverTimestamp(),
  }, { merge: true });
  // Supplement-Mikros sind nicht pro-Tag gecached (addSupplementMicros läuft
  // in getWeeklyMicros immer frisch) — ohne diese Invalidierung würde der
  // Wochen-Cache Supplement-Änderungen ignorieren, siehe nutrition.js.
  void invalidateWeekMicroCache(date).catch(() => {});
}

export async function updateIntakeInLog(date, intakeId, updates) {
  const log = await mutateCloudLog("supplements", date, { intake_id: intakeId, updates });
  return log.intakes.find(i => i.id === intakeId);
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

  const snap = await getDocs(query(collection(db, "supplements", getUid(), "logs"), orderBy(documentId(), "desc"), startAt(dates[0]), endAt(dates[dates.length - 1])));
  const logsMap = {};
  snap.forEach(doc => { logsMap[doc.id] = doc.data(); });
  const catalog = await getSupplementsCatalog();
  return { ok: true, anchor: anchorDate, days, stats: summarizeSupplementLogs(catalog, logsMap, dates, todayISO()) };
}
