/**
 * Firestore Töpfe — users/{uid}/fuel_pots/{potId}
 *
 * Ein Dokument je Topf (gekochtes Gericht + gegessene Anteile je Tag, siehe lib/potsLogic.js).
 * Liegt unter users/{uid}/…, damit die deployten Rules (users/{uid}/{document=**}) greifen.
 */

import {
  collection,
  doc,
} from "firebase/firestore";
import { getDocs, setDoc as firestoreSetDoc, deleteDoc as firestoreDeleteDoc } from "./offline.js";
import { db } from "../../firebase.js";
import { getUid } from "./core.js";
import { withStorageFeedback } from "../../storageFeedback.js";

const potsCol = () => collection(db, "users", getUid(), "fuel_pots");

export async function listPots() {
  const uid = getUid();
  const snap = await getDocs(potsCol());
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    // Cross-User-Schutz: Dokumente mit fremdem owner_uid verwerfen.
    .filter((p) => !p.owner_uid || p.owner_uid === uid)
    .sort((a, b) => (b.cooked_on || "").localeCompare(a.cooked_on || "") || (b.created_at || "").localeCompare(a.created_at || ""));
}

export async function savePot(pot) {
  // Firestore verwirft undefined-Felder; JSON-Roundtrip entfernt sie.
  const payload = JSON.parse(JSON.stringify({ ...pot, owner_uid: getUid(), updated_at: new Date().toISOString() }));
  await withStorageFeedback("Topf", () => firestoreSetDoc(doc(potsCol(), pot.id), payload));
}

export async function deletePot(id) {
  await withStorageFeedback("Topf", () => firestoreDeleteDoc(doc(potsCol(), id)));
}
