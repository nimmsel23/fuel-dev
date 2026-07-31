/**
 * Fuel Frame Map — users/{uid}/meta/fuelFrame
 *
 * AlphaOS-Frame-Map-Konzept (~/aos/game/gas-frame-map), aber nur die
 * Domain "Fuel" statt aller vier (Body/Being/Balance/Business) — 5 feste
 * Reflexionsfragen, EIN aktueller Stand, keine Snapshot-Historie.
 */

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase.js";
import { getUid } from "./core.js";

export async function getFuelFrame() {
  const snap = await getDoc(doc(db, "users", getUid(), "meta", "fuelFrame"));
  return snap.exists() ? snap.data() : null;
}

export async function saveFuelFrame(answers) {
  await setDoc(doc(db, "users", getUid(), "meta", "fuelFrame"), {
    ...answers,
    updated_at: serverTimestamp(),
  });
}
