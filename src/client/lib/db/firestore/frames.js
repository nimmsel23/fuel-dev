/**
 * Firestore Fuel Frames — unveränderliche Anamnese-Snapshots
 *
 * Collection: users/{uid}/fuelFrames/{frameId}
 *
 * Jeder Frame ist ein eingefrorener Stand der Ernährungs-Anamnese
 * (FuelProfile.jsx) zu einem Zeitpunkt — erlaubt später den Vergleich
 * "FRAME 01 → FRAME 02" (was hat sich verändert, was hat funktioniert).
 * Frames werden nie editiert, nur neu angelegt.
 */

import {
  collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase.js";
import { getUid } from "./core.js";

export async function saveFuelFrame(frameData) {
  const ref = collection(db, "users", getUid(), "fuelFrames");
  const docRef = await addDoc(ref, { ...frameData, created_at: serverTimestamp() });
  return { id: docRef.id };
}

export async function getFuelFrames(limitCount = 20) {
  const q = query(
    collection(db, "users", getUid(), "fuelFrames"),
    orderBy("created_at", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
