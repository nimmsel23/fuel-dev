/**
 * Firestore Notes — nutrition/{uid}/journal/{date} (Freitext-Notizen)
 */

import { doc, getDoc, setDoc, serverTimestamp, collection, query, getDocs, orderBy, limit, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../../firebase.js";
import { getUid } from "./core.js";
import { todayISO } from "./utils.js";

export async function getNotes(date = todayISO()) {
  const snap = await getDoc(doc(db, "nutrition", getUid(), "journal", date));
  return snap.exists() ? snap.data().content : "";
}

export async function saveNotes(date = todayISO(), content) {
  // merge:true — sonst würde das Überschreiben der Notiz das ai_pending-Feld
  // (wartende AI-Logger-Einträge) desselben Tages-Dokuments mitlöschen.
  await setDoc(doc(db, "nutrition", getUid(), "journal", date), {
    date,
    content,
    updated_at: serverTimestamp(),
  }, { merge: true });
}

// "Wartend"-Ablage für AI-Logger-Rohtext: sofort persistiert, unabhängig vom
// Erfolg der nachgelagerten Gemini-Analyse. Lebt im selben Journal-Dokument
// wie die Freitext-Notiz des Tages, aber als eigenes Feld — kein Fake-Meal.
export async function getPendingAiEntries(date = todayISO()) {
  const snap = await getDoc(doc(db, "nutrition", getUid(), "journal", date));
  return snap.exists() ? (snap.data().ai_pending || []) : [];
}

export async function addPendingAiEntry(date, entry) {
  await setDoc(doc(db, "nutrition", getUid(), "journal", date), {
    date,
    ai_pending: arrayUnion(entry),
    updated_at: serverTimestamp(),
  }, { merge: true });
}

export async function removePendingAiEntry(date, entry) {
  await setDoc(doc(db, "nutrition", getUid(), "journal", date), {
    ai_pending: arrayRemove(entry),
  }, { merge: true });
}

export async function getNutritionNotesHistory(limitCount = 50) {
  const q = query(
    collection(db, "nutrition", getUid(), "journal"),
    orderBy("date", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: `nutrition-notes-${d.id}`,
    date: d.id,
    text: d.data().content || "",
    type: "nutrition-notes",
    time: `${d.id}T12:00:00`,
  }));
}
