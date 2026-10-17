import { withStorageFeedback } from "../../storageFeedback.js";
/**
 * Firestore Devices — users/{uid}/devices/{deviceId}
 *
 * Jedes Gerät, auf dem sich der Nutzer einloggt, legt hier einen eigenen
 * Eintrag an. Die Collection ist app-übergreifend (fuel/fitness/vitalos teilen
 * sich dasselbe Schema): `app` sagt, welche App den Eintrag angelegt hat,
 * app-spezifische Geräte-Wahlen liegen unter `prefs.<app>` (hier
 * `prefs.fuel.frontdoor`). Die Geräte-ID liegt im localStorage und gilt nur pro
 * Origin — dasselbe Telefon hat in fuel und fitness daher zwei Einträge. Eigene
 * Collection statt Feld in meta/settings, weil saveUserSettings() das
 * Settings-Doc komplett überschreibt. Die Rules (`users/{uid}/**`) decken
 * die Collection bereits ab.
 */

import { doc, getDoc, setDoc as firestoreSetDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase.js";
import { getUid } from "./core.js";
const setDoc = (...args) => withStorageFeedback("Gerät", () => firestoreSetDoc(...args));

const APP = "fuel";
const DEVICE_ID_KEY = "fuel-device-id";

// Pro Browser-Profil stabile ID. Gelöschter Speicher = neues Gerät, das ist gewollt.
export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function deviceLabel() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const os = /Android/i.test(ua) ? "Android"
    : /iPhone|iPad|iPod/i.test(ua) ? "iOS"
    : /Windows/i.test(ua) ? "Windows"
    : /Mac OS X/i.test(ua) ? "macOS"
    : /Linux/i.test(ua) ? "Linux"
    : "Gerät";
  const browser = /Edg\//.test(ua) ? "Edge"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : "Browser";
  return `${os} · ${browser}`;
}

export async function getDevice() {
  const id = getDeviceId();
  if (!id) return null;
  const snap = await getDoc(doc(db, "users", getUid(), "devices", id));
  return snap.exists() ? snap.data() : null;
}

// registered_at wird nur beim Erstanlegen gesetzt.
export async function saveDevice(frontdoor) {
  const id = getDeviceId();
  if (!id) return;
  const existing = await getDevice();
  await setDoc(doc(db, "users", getUid(), "devices", id), {
    app: APP,
    prefs: { [APP]: { frontdoor } },
    label: deviceLabel(),
    ...(existing?.registered_at ? {} : { registered_at: serverTimestamp() }),
    last_seen_at: serverTimestamp(),
  }, { merge: true });
}
