/**
 * Firestore Core — Auth + Firebase-Instanzen (Fuel Centre, Multi-User)
 */

import {
  signInWithPopup, signInWithRedirect, getRedirectResult,
  onAuthStateChanged,
  signOut as fbSignOut,
} from "firebase/auth";
import { serverTimestamp, doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth, googleProvider } from "../../firebase.js";

export { serverTimestamp, db, auth, googleProvider };

let signInAttempt = null;

// ── Auth ──────────────────────────────────────────────────────────────────────

// Coach-Klientenliste (fitness-app ClientsPanel) liest nur fitness/{uid}/profile/metadata.
// Wer sich nur in Fuel einloggt, bekam dort nie ein Profil und fehlte in der Liste.
// Legt das Dokument einmalig an; vorhandene Felder (z. B. von Coach gesetzter clientStatus) bleiben unberührt.
async function ensureCoachProfile(user) {
  try {
    const ref = doc(db, "fitness", user.uid, "profile", "metadata");
    if ((await getDoc(ref)).exists()) return;
    await setDoc(ref, {
      displayName: user.displayName || user.email || "",
      email: user.email || "",
      clientStatus: "friend",
      updated_at: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.warn("[Auth] Coach-Profil nicht angelegt:", error);
  }
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, (user) => {
    console.log(`[Auth] User status changed: ${user ? user.email : "logged out"}`);
    if (user) ensureCoachProfile(user);
    callback(user);
  });
}

// Ergebnis eines vorangegangenen Redirect-Logins einsammeln; fängt vor allem Fehler ab
// (onAuthStateChanged feuert ohnehin).
getRedirectResult(auth).catch((error) => {
  console.error("Redirect-Login Fehler:", error);
});

export function signIn() {
  // Ein zweiter Tap während des ersten Popup-/Redirect-Versuchs startet bei Firebase
  // einen konkurrierenden Request und cancelt den ersten (auth/cancelled-popup-request).
  if (signInAttempt) return signInAttempt;
  signInAttempt = (async () => {
    try {
      // Popup zuerst, auch auf iOS. Der Mini-App-Build setzt authDomain auf dieselbe
      // Hosting-Site, damit der Redirect-Fallback auf iOS seine Session nicht verliert.
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      // Popup vom Browser geblockt → Redirect-Fallback.
      if (error?.code === "auth/popup-blocked") {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      console.error("Login Fehler:", error);
      throw error;
    }
  })().finally(() => { signInAttempt = null; });
  return signInAttempt;
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
