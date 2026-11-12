import { doc } from "firebase/firestore";
import { postJson } from "@api";
import { db } from "./firebase.js";
import { getUid } from "./db/firestore/core.js";
import { getDoc, setDoc } from "./db/firestore/offline.js";
import { getSupplementLog, getSupplementsCatalog } from "./db/firestore/supplements.js";
import { planQuickYes, planSnooze, startPendingSupplementAction } from "./supplementActionLink.js";

async function performSupplementAction(pending) {
  if (pending.action === "quick-yes") {
    const [log, catalog] = await Promise.all([
      getSupplementLog(pending.date),
      getSupplementsCatalog(),
    ]);
    const intakes = planQuickYes(pending.supplementIds, log?.intakes, catalog, pending.date);
    for (const intake of intakes) {
      await postJson("/supplements/log", { date: pending.date, intake });
    }
    return { action: pending.action, date: pending.date, intakes };
  }

  const ref = doc(db, "users", getUid(), "meta", "supplement_snooze");
  const snap = await getDoc(ref);
  const updates = planSnooze(pending.supplementIds, snap.exists() ? snap.data() : {}, Date.now());
  if (Object.keys(updates).length) await setDoc(ref, updates, { merge: true });
  return { action: pending.action, date: pending.date, intakes: [] };
}

export function executePendingSupplementAction() {
  return startPendingSupplementAction(performSupplementAction);
}
