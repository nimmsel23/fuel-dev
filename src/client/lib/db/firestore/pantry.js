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

import { collection, doc, getDoc, getDocs, setDoc as firestoreSetDoc, deleteDoc as firestoreDeleteDoc, writeBatch } from "firebase/firestore";
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

// Mehrere Docs atomar schreiben (Firestore-Batch: max. 500 — Einkäufe/Prospekte bleiben weit darunter).
async function saveMany(kind, items) {
  if (!items.length) return;
  await withStorageFeedback(LABELS[kind], async () => {
    for (let i = 0; i < items.length; i += 400) {
      const batch = writeBatch(db);
      for (const item of items.slice(i, i + 400)) batch.set(doc(col(kind), item.id), payload(item));
      await batch.commit();
    }
  });
}

const remove = (kind, id) => withStorageFeedback(LABELS[kind], () => firestoreDeleteDoc(doc(col(kind), id)));

export const listPantry = () => list("pantry");
export const savePantryItems = (items) => saveMany("pantry", items);
export const deletePantryItem = (id) => remove("pantry", id);

export async function listReceipts(max = 30) {
  return (await list("receipts")).sort((a, b) => (b.date || "").localeCompare(a.date || "") || byRecent(a, b)).slice(0, max);
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
  await withStorageFeedback("Küche", () => firestoreSetDoc(doc(db, "users", getUid(), "meta", "kitchen"), payload(settings), { merge: true }));
}
