/**
 * Firestore Küche — Vorrat, Bons, Einkaufszettel, Aktionen, Küchen-Einstellungen
 *
 * users/{uid}/fuel_pantry/{id}    ein Doc je Vorratsposten
 * users/{uid}/fuel_receipts/{id}  Bon/Einkauf (nur Positionen, kein Foto)
 * users/{uid}/fuel_shopping/{id}  Einkaufszettel-Posten (done = abgehakt)
 * users/{uid}/fuel_deals/{id}     vom Nutzer eingelesene Aktionen (nur aus eigenen Prospekten)
 * users/{uid}/meta/kitchen        Händler/Ort, Wünsche
 *
 * Alles unter users/{uid}/…, damit die deployten Rules (users/{uid}/{document=**}) greifen.
 */

import { collection, doc, getDoc, getDocs, query, orderBy, limit, setDoc as firestoreSetDoc, deleteDoc as firestoreDeleteDoc, writeBatch } from "firebase/firestore";
import { db } from "../../firebase.js";
import { getUid } from "./core.js";
import { withStorageFeedback } from "../../storageFeedback.js";
import { stripUndefined } from "../../kitchenLogic.js";

const COLLECTIONS = { pantry: "fuel_pantry", receipts: "fuel_receipts", shopping: "fuel_shopping", deals: "fuel_deals" };
const LABELS = { pantry: "Vorrat", receipts: "Einkauf", shopping: "Einkaufszettel", deals: "Aktionen" };
const col = (kind) => collection(db, "users", getUid(), COLLECTIONS[kind]);

const byRecent = (a, b) => (b.created_at || "").localeCompare(a.created_at || "");

async function list(kind) {
  const uid = getUid();
  const snap = await getDocs(col(kind));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    // Cross-User-Schutz: Dokumente mit fremdem owner_uid verwerfen.
    .filter((item) => !item.owner_uid || item.owner_uid === uid)
    .sort(byRecent);
}

const payload = (item) => stripUndefined({ ...item, owner_uid: getUid(), updated_at: new Date().toISOString() });

// Offline wartet Firestore mit der Bestätigung, bis wieder Netz da ist — das Schreiben ist lokal aber sofort gesichert
// (persistenter Cache) und wird später nachgeschickt. Dann nicht blockieren, sonst hängt die UI ewig im "Speichere …".
const feedback = (kind, run) => withStorageFeedback(LABELS[kind] || kind, () => {
  const write = run();
  if (typeof navigator !== "undefined" && navigator.onLine === false) { write.catch(() => {}); return Promise.resolve(); }
  return write;
});

// Mehrere Docs schreiben (Firestore-Batch: max. 500 Operationen — hier in 400er-Schritten).
// ops: [{ kind: "pantry"|"receipts"|"shopping"|"deals", item }] — ein Aufruf ist je 400 Operationen atomar.
async function commitOps(label, ops) {
  if (!ops.length) return;
  await feedback(label, async () => {
    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(db);
      for (const { kind, item } of ops.slice(i, i + 400)) batch.set(doc(col(kind), item.id), payload(item));
      await batch.commit();
    }
  });
}

const saveMany = (kind, items) => commitOps(kind, items.map((item) => ({ kind, item })));

// Einkauf übernehmen (Bon/Zettel): Vorrat, Bon und Zettel-Posten in EINEM Batch — entweder alles oder nichts, damit
// ein erneuter Versuch nach einem Fehler die Mengen nicht doppelt addiert.
export const commitKitchenBatch = ({ pantry = [], receipts = [], shopping = [] }) => commitOps("pantry", [
  ...pantry.map((item) => ({ kind: "pantry", item })),
  ...receipts.map((item) => ({ kind: "receipts", item })),
  ...shopping.map((item) => ({ kind: "shopping", item })),
]);

const remove = (kind, id) => feedback(kind, () => firestoreDeleteDoc(doc(col(kind), id)));

export const listPantry = () => list("pantry");
export const savePantryItems = (items) => saveMany("pantry", items);
export const deletePantryItem = (id) => remove("pantry", id);

// Nur die jüngsten Bons laden (Verlauf wächst sonst unbegrenzt mit).
export async function listReceipts(max = 30) {
  const uid = getUid();
  const snap = await getDocs(query(col("receipts"), orderBy("date", "desc"), limit(max)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((item) => !item.owner_uid || item.owner_uid === uid)
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || byRecent(a, b));
}
export const saveReceipt = (receipt) => saveMany("receipts", [receipt]);
export const deleteReceipt = (id) => remove("receipts", id);

export const listShopping = () => list("shopping");
export const saveShoppingItems = (items) => saveMany("shopping", items);
export const deleteShoppingItem = (id) => remove("shopping", id);

export const listDeals = () => list("deals");
export const saveDeals = (items) => saveMany("deals", items);
export const deleteDeal = (id) => remove("deals", id);

export async function getKitchenSettings() {
  const snap = await getDoc(doc(db, "users", getUid(), "meta", "kitchen"));
  return snap.exists() ? snap.data() : {};
}

export async function saveKitchenSettings(settings) {
  await feedback("Küche", () => firestoreSetDoc(doc(db, "users", getUid(), "meta", "kitchen"), payload(settings), { merge: true }));
}
