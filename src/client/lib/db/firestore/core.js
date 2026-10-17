/**
 * Firestore Core — Auth + Firebase-Instanzen (Fuel Centre, Multi-User)
 */

import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut as fbSignOut,
} from "firebase/auth";
import { serverTimestamp } from "firebase/firestore";
import { db, auth, googleProvider } from "../../firebase.js";

export { serverTimestamp, db, auth, googleProvider };

// ── Auth ──────────────────────────────────────────────────────────────────────

export function watchAuth(callback) {
  return onAuthStateChanged(auth, (user) => {
    console.log(`[Auth] User status changed: ${user ? user.email : "logged out"}`);
    callback(user);
  });
}

// Ergebnis eines vorangegangenen Redirect-Logins einsammeln (beim App-Start aufrufen;
// onAuthStateChanged feuert danach ohnehin, das hier fängt vor allem Fehler ab).
getRedirectResult(auth).catch((error) => {
  console.error("Redirect-Login Fehler:", error);
});

export async function signIn() {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    // Popup vom Browser geblockt → Redirect als Fallback (bei Redirect über fremde authDomain
    // kann iOS den Login-Status verlieren, deshalb nur als Notlösung).
    if (error?.code === "auth/popup-blocked") {
      await signInWithRedirect(auth, googleProvider);
      return;
    }
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

export function getUid() {
  if (!auth.currentUser) throw new Error("User not authenticated");
  return auth.currentUser.uid;
}

// Wie getUid(), aber ohne Throw — für Hintergrund-Syncs (z. B. Settings-Store),
// die vor dem Login einfach nichts tun sollen.
export function getUidOrNull() {
  return auth.currentUser?.uid || null;
}
