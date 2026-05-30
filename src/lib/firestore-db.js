/**
 * Firestore Data Layer — Fuel Centre (Multi-User)
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from "firebase/firestore";
import { 
  signInWithPopup, 
  onAuthStateChanged,
  signOut as fbSignOut 
} from "firebase/auth";
import { db, auth, googleProvider } from "./firebase.js";

let currentUid = "default";

// ── Auth ──────────────────────────────────────────────────────────────────────

export function watchAuth(callback) {
  return onAuthStateChanged(auth, (user) => {
    currentUid = user ? user.uid : "default";
    console.log(`[Auth] User status changed: ${user ? user.email : "logged out"} (UID: ${currentUid})`);
    callback(user);
  });
}

export async function signIn() {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Login Fehler:", error);
    throw error;
  }
}

export async function signOut() {
  try {
    await fbSignOut(auth);
  } catch (error) {
    console.error("Logout Fehler:", error);
    throw error;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getUid() {
  return auth.currentUser?.uid || currentUid;
}

export { serverTimestamp, db };

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function localToday() { return todayISO(); }

function randomId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Nutrition ─────────────────────────────────────────────────────────────────

export async function getNutritionCatalog() {
  const ref = doc(db, "nutrition", getUid(), "meta", "catalog");
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().items || []) : [];
}

export async function getNutritionLog(date = todayISO()) {
  const snap = await getDoc(doc(db, "nutrition", getUid(), "logs", date));
  return snap.exists() ? snap.data() : { date, meals: [], water_ml: 0 };
}

export async function saveNutritionLog(date, data) {
  await setDoc(doc(db, "nutrition", getUid(), "logs", date), {
    ...data,
    updated_at: serverTimestamp(),
  }, { merge: true });
}

export async function getNutritionLogsInRange(dates) {
  const q = query(
    collection(db, "nutrition", getUid(), "logs"),
    where("date", "in", dates)
  );
  const snap = await getDocs(q);
  const map = {};
  snap.forEach(d => { map[d.id] = d.data(); });
  return map;
}

// ── Journal ───────────────────────────────────────────────────────────────────

export async function getJournal(date = todayISO()) {
  const snap = await getDoc(doc(db, "nutrition", getUid(), "journal", date));
  return snap.exists() ? snap.data().content : "";
}

export async function saveJournal(date = todayISO(), content) {
  await setDoc(doc(db, "nutrition", getUid(), "journal", date), {
    date,
    content,
    updated_at: serverTimestamp(),
  });
}

// ── Supplements ───────────────────────────────────────────────────────────────

export async function getSupplementsCatalog() {
  const ref = doc(db, "supplements", getUid(), "meta", "catalog");
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().items || []) : [];
}

export async function getSupplementLog(date = todayISO()) {
  const snap = await getDoc(doc(db, "supplements", getUid(), "logs", date));
  return snap.exists() ? snap.data() : { date, intakes: [] };
}

export async function getSupplementStats(anchorDate, days = 30) {
  // Vereinfachte Stats aus Firestore
  // In einer echten App wuerden wir hier komplexere Queries machen oder aggregieren
  return { intakes: [] }; // Placeholder
}
