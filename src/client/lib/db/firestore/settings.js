import { withStorageFeedback } from "../../storageFeedback.js";
/**
 * Firestore Settings — users/{uid}/meta/settings
 */

import { doc, getDoc, setDoc as firestoreSetDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase.js";
import { getUid } from "./core.js";
const setDoc = (...args) => withStorageFeedback("Profil / Einstellungen", () => firestoreSetDoc(...args));

export async function getUserSettings() {
  const snap = await getDoc(doc(db, "users", getUid(), "meta", "settings"));
  return snap.exists() ? snap.data() : null;
}

export async function saveUserSettings(settings) {
  await setDoc(doc(db, "users", getUid(), "meta", "settings"), {
    ...settings,
    updated_at: serverTimestamp(),
  });
}

export async function saveFcmToken(token) {
  await setDoc(doc(db, "users", getUid(), "fcm", "token"), {
    token,
    updated_at: serverTimestamp()
  });
}
