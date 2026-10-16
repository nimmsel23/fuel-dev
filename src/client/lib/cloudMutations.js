import { doc, runTransaction, serverTimestamp, deleteField } from "firebase/firestore";
import { db } from "./firebase.js";
import { getUid } from "./db/firestore/core.js";
import { dateToISOWeek } from "./db/firestore/utils.js";
import { catalogFromLoggedMeal } from "./loggedMealCatalog.js";
import { changeLog } from "./cloudLogState.js";

function invalidateWeek(tx, uid, date) {
  const { year, week } = dateToISOWeek(date);
  tx.set(doc(db, "nutrition", uid, "weekMicrosCache", `${year}-W${String(week).padStart(2, "0")}`), { complete: false }, { merge: true });
}

export async function mutateCloudLog(kind, date, command) {
  const uid = getUid();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Ungültiges Datum.");
  const ref = doc(db, kind, uid, "logs", date);
  const targetDate = command.new_date && command.new_date !== date ? command.new_date : null;
  if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) throw new Error("Ungültiges Zieldatum.");
  return runTransaction(db, async tx => {
    if (getUid() !== uid) throw new Error("Konto hat gewechselt.");
    const receiptRef = command.operation_id ? doc(db, kind, uid, "operations", command.operation_id) : null;
    const receipt = receiptRef ? await tx.get(receiptRef) : null;
    const snap = await tx.get(ref);
    if (receipt?.exists()) return snap.exists() ? snap.data() : { date };
    const current = snap.exists() ? snap.data() : { date, [kind === "nutrition" ? "meals" : "intakes"]: [] };
    // All reads precede writes. A concurrent change retries the entire move.
    const targetRef = targetDate ? doc(db, kind, uid, "logs", targetDate) : null;
    const targetSnap = targetRef ? await tx.get(targetRef) : null;
    const shouldCatalog = kind === "nutrition" && command.meal?.description && !command.meal_id && !command.meal.catalog_id;
    const catalogRef = shouldCatalog ? doc(db, "nutrition", uid, "meta", "catalog") : null;
    const catalogSnap = catalogRef ? await tx.get(catalogRef) : null;
    const next = changeLog(kind, current, command);
    const payload = log => ({ ...log, updated_at: serverTimestamp(), ...(kind === "nutrition" ? {
      micro_totals: deleteField(), micro_totals_complete: deleteField(),
    } : {}) });
    if (targetRef) {
      const moved = next.meals.find(m => m.id === command.meal_id);
      if (!moved) throw new Error("Mahlzeit nicht gefunden.");
      const target = targetSnap.exists() ? targetSnap.data() : { date: targetDate, meals: [] };
      if ((target.meals || []).some(m => m.id === moved.id)) throw new Error("Mahlzeit existiert bereits am Zieldatum.");
      // A fresh ID avoids resurrecting a previous tombstone on the target day.
      const moveId = command.move_id;
      if (!moveId) throw new Error("Verschiebe-ID fehlt.");
      next.meals = next.meals.filter(m => m.id !== moved.id);
      next.deleted_meal_ids = [...new Set([...(next.deleted_meal_ids || []), moved.id])];
      target.meals = [...(target.meals || []), { ...moved, id: moveId }];
      tx.set(targetRef, payload({ ...target, date: targetDate }), { merge: true });
      invalidateWeek(tx, uid, targetDate);
    }
    if (catalogRef) tx.set(catalogRef, { items: catalogFromLoggedMeal(catalogSnap.exists() ? catalogSnap.data().items || [] : [], command.meal), updated_at: serverTimestamp() }, { merge: true });
    tx.set(ref, payload({ ...next, date }), { merge: true });
    if (receiptRef) tx.set(receiptRef, { date, applied_at: serverTimestamp() });
    invalidateWeek(tx, uid, date);
    return next;
  });
}

export async function mutateCloudCatalog(kind, change) {
  const uid = getUid();
  const ref = doc(db, kind, uid, "meta", "catalog");
  return runTransaction(db, async tx => {
    if (getUid() !== uid) throw new Error("Konto hat gewechselt.");
    const snap = await tx.get(ref);
    const items = change(snap.exists() ? snap.data().items || [] : []);
    tx.set(ref, { items, updated_at: serverTimestamp() }, { merge: true });
    return items;
  });
}
