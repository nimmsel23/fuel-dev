/**
 * Firestore Data Layer
 * Struktur:
 *   nutrition/{uid}/logs/{date}        → {date, meals:[], water_ml:0}
 *   nutrition/{uid}/journal/{date}     → {date, content:""}
 *   supplements/{uid}/meta/catalog     → {items:[]}
 *   supplements/{uid}/logs/{date}      → {date, intakes:[]}
 *
 * uid: "default" bis Firebase Auth eingebaut ist
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase.js";

const UID = "default";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function randomId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Nutrition ─────────────────────────────────────────────────────────────────

export async function getNutritionLog(date = todayISO()) {
  const snap = await getDoc(doc(db, "nutrition", UID, "logs", date));
  return snap.exists() ? snap.data() : { date, meals: [], water_ml: 0 };
}

export async function addMeal(date = todayISO(), meal) {
  const entry = {
    id: randomId("meal"),
    type: meal.type,
    description: meal.description,
    notes: meal.notes || "",
    kcal: Number(meal.kcal) || 0,
    protein: Number(meal.protein) || 0,
    carbs: Number(meal.carbs) || 0,
    fat: Number(meal.fat) || 0,
    time: new Date().toISOString(),
  };
  await setDoc(
    doc(db, "nutrition", UID, "logs", date),
    { date, meals: arrayUnion(entry), updated_at: serverTimestamp() },
    { merge: true },
  );
  return entry;
}

export async function setWater(date = todayISO(), water_ml) {
  await setDoc(
    doc(db, "nutrition", UID, "logs", date),
    { date, water_ml: Number(water_ml), updated_at: serverTimestamp() },
    { merge: true },
  );
}

// ── Journal ───────────────────────────────────────────────────────────────────

export async function getJournal(date = todayISO()) {
  const snap = await getDoc(doc(db, "nutrition", UID, "journal", date));
  return snap.exists() ? snap.data().content : "";
}

export async function saveJournal(date = todayISO(), content) {
  await setDoc(doc(db, "nutrition", UID, "journal", date), {
    date,
    content,
    updated_at: serverTimestamp(),
  });
}

// ── Supplements ───────────────────────────────────────────────────────────────

const SUPPLEMENT_SEED = [
  { id: "melatonin",  name: "Melatonin",   unit: "mg",  default_dose: 1,    default_time_of_day: "night"   },
  { id: "glycin",     name: "Glycin",       unit: "g",   default_dose: 3,    default_time_of_day: "night"   },
  { id: "kollagen",   name: "Kollagen",     unit: "g",   default_dose: 10,   default_time_of_day: "morning" },
  { id: "magnesium",  name: "Magnesium",    unit: "mg",  default_dose: 200,  default_time_of_day: "evening" },
  { id: "vitamin_d3", name: "Vitamin D3",   unit: "IU",  default_dose: 2000, default_time_of_day: "morning" },
  { id: "omega3",     name: "Omega-3",      unit: "mg",  default_dose: 1000, default_time_of_day: "morning" },
];

export async function getSupplementsCatalog() {
  const ref = doc(db, "supplements", UID, "meta", "catalog");
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data().items || [];
  await setDoc(ref, { items: SUPPLEMENT_SEED, updated_at: serverTimestamp() });
  return SUPPLEMENT_SEED;
}

export async function addSupplementToCatalog(item) {
  const newItem = {
    id: item.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40),
    name: item.name,
    unit: item.unit || "mg",
    default_dose: Number(item.default_dose) || null,
    default_time_of_day: item.default_time_of_day || "any",
  };
  await setDoc(
    doc(db, "supplements", UID, "meta", "catalog"),
    { items: arrayUnion(newItem), updated_at: serverTimestamp() },
    { merge: true },
  );
  return newItem;
}

export async function getSupplementLog(date = todayISO()) {
  const snap = await getDoc(doc(db, "supplements", UID, "logs", date));
  return snap.exists() ? snap.data() : { date, intakes: [] };
}

export async function addSupplementIntake(date = todayISO(), intake) {
  const entry = {
    id: randomId("supp"),
    supplement_id: intake.supplement_id,
    name: intake.name,
    dose: Number(intake.dose) || null,
    unit: intake.unit || "mg",
    time_of_day: intake.time_of_day || "any",
    notes: intake.notes || "",
    time: new Date().toISOString(),
  };
  await setDoc(
    doc(db, "supplements", UID, "logs", date),
    { date, intakes: arrayUnion(entry), updated_at: serverTimestamp() },
    { merge: true },
  );
  return entry;
}

export async function removeSupplementIntake(date = todayISO(), intake) {
  await updateDoc(doc(db, "supplements", UID, "logs", date), {
    intakes: arrayRemove(intake),
  });
}

// ── Food Search (Proxy via lokalem Server oder Cloud Function) ─────────────────

export async function searchFood(q, limit = 15) {
  const res = await fetch(`/nutrition/search?q=${encodeURIComponent(q)}&limit=${limit}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).results || [];
}
