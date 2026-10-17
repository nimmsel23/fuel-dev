import { withStorageFeedback } from "../../storageFeedback.js";
/**
 * Firestore Shared Profile — users/{uid}/meta/profile
 *
 * Stammdaten des Menschen, app-übergreifend (fuel/fitness/vitalos): nur Felder,
 * die in jeder App dieselbe Bedeutung haben. App-spezifisches (Ziele, Reminder,
 * Aktivitätsfaktor …) bleibt in der jeweiligen App (fuel: meta/settings).
 * Kanonische Namen/Werte: gender "m"|"f", heightCm, weightKg (camelCase).
 */

import { doc, getDoc, setDoc as firestoreSetDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase.js";
import { getUid } from "./core.js";
const setDoc = (...args) => withStorageFeedback("Profil", () => firestoreSetDoc(...args));

export const PROFILE_FIELDS = ["gender", "age", "heightCm", "weightKg", "chronicConditions", "medications"];

// Ältere Apps schreiben "male"/"female".
function normalize(data) {
  const out = {};
  for (const k of PROFILE_FIELDS) if (data?.[k] !== undefined && data[k] !== null) out[k] = data[k];
  if (out.gender === "male") out.gender = "m";
  if (out.gender === "female") out.gender = "f";
  return out;
}

export async function getSharedProfile() {
  const snap = await getDoc(doc(db, "users", getUid(), "meta", "profile"));
  return snap.exists() ? normalize(snap.data()) : null;
}

// Merge: schreibt nur die übergebenen Felder, andere Apps' Felder bleiben unangetastet.
export async function saveSharedProfile(partial) {
  const data = normalize(partial);
  if (!Object.keys(data).length) return;
  await setDoc(doc(db, "users", getUid(), "meta", "profile"), {
    ...data,
    updated_at: serverTimestamp(),
  }, { merge: true });
}
