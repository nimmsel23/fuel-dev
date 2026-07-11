/**
 * Firestore Journal — nutrition/{uid}/journal/{date} (Freitext-Notizen)
 */

import { doc, getDoc, setDoc, serverTimestamp, collection, query, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "../../firebase.js";
import { getUid } from "./core.js";
import { todayISO } from "./utils.js";

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

export async function getNutritionJournalHistory(limitCount = 50) {
  const q = query(
    collection(db, "nutrition", getUid(), "journal"),
    orderBy("date", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: `nutrition-journal-${d.id}`,
    date: d.id,
    text: d.data().content || "",
    type: "nutrition-journal",
    time: `${d.id}T12:00:00`,
  }));
}
