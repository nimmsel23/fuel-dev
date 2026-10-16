import { collection, doc, getDocsFromServer, getDocFromServer, runTransaction, serverTimestamp, deleteField, waitForPendingWrites } from "firebase/firestore";
import { db } from "./firebase.js";
import { getUid } from "./db/firestore/core.js";
import { outboxEntries } from "./cloudOutbox.js";
import { BACKUP_KINDS, mergeBackupDocument, portableData, validateBackup } from "./backupFormat.js";

const scopes = {
  "nutrition-log": ["nutrition", "logs"], "nutrition-note": ["nutrition", "journal"],
  "nutrition-catalog": ["nutrition", "meta", "catalog"],
  "supplement-log": ["supplements", "logs"], "supplement-catalog": ["supplements", "meta", "catalog"],
  settings: ["users", "meta", "settings"], "fuel-frame": ["users", "meta", "fuelFrame"],
};
const parts = (uid, kind) => { const [root, ...rest] = scopes[kind]; return [root, uid, ...rest]; };
const reference = (uid, item) => {
  const path = parts(uid, item.kind);
  return doc(db, ...(path.length === 3 ? [...path, item.id] : path));
};
function assertReady(uid) {
  if (getUid() !== uid) throw new Error("Konto hat gewechselt. Vorgang abgebrochen.");
  if (!navigator.onLine) throw new Error("Backup und Wiederherstellung benötigen eine Cloud-Verbindung.");
  if (outboxEntries(uid).length) throw new Error("Bitte zuerst die ausstehenden Änderungen synchronisieren.");
}

async function waitForCloud() {
  let timer;
  try {
    await Promise.race([waitForPendingWrites(db), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Cloud bestätigt ausstehende Schreibvorgänge noch nicht. Bitte später erneut versuchen.")), 15000); })]);
  } finally { clearTimeout(timer); }
}

export async function exportCloudBackup() {
  const uid = getUid(); assertReady(uid);
  await waitForCloud(); assertReady(uid);
  const groups = await Promise.all(BACKUP_KINDS.map(async kind => {
    const path = parts(uid, kind);
    if (path.length === 3) {
      const snap = await getDocsFromServer(collection(db, ...path));
      return snap.docs.map(d => ({ kind, id: d.id, data: portableData(d.data()) }));
    }
    const snap = await getDocFromServer(doc(db, ...path));
    return snap.exists() ? [{ kind, id: snap.id, data: portableData(snap.data()) }] : [];
  }));
  assertReady(uid);
  return validateBackup({ format: "fuel-backup", version: 1, uid, exportedAt: new Date().toISOString(), documents: groups.flat() }, uid);
}

export async function previewCloudRestore(input) {
  const uid = getUid(); assertReady(uid);
  const backup = validateBackup(input, uid);
  await waitForCloud(); assertReady(uid);
  let addedDocuments = 0, changedDocuments = 0, addedEntries = 0;
  // Bound concurrent reads for large backups.
  for (let i = 0; i < backup.documents.length; i += 20) {
    await Promise.all(backup.documents.slice(i, i + 20).map(async item => {
      const snap = await getDocFromServer(reference(uid, item));
      const merged = mergeBackupDocument(item.kind, snap.exists() ? snap.data() : null, item.data);
      if (!snap.exists()) addedDocuments++;
      if (merged.changed) changedDocuments++;
      addedEntries += merged.addedEntries;
    }));
    assertReady(uid);
  }
  return { backup, addedDocuments, changedDocuments, addedEntries };
}

export async function restoreCloudBackup(input, onProgress = () => {}) {
  const uid = getUid(); assertReady(uid);
  const backup = validateBackup(input, uid);
  let completed = 0, changed = 0;
  try {
    for (const item of backup.documents) {
      assertReady(uid);
      const applied = await runTransaction(db, async tx => {
        assertReady(uid);
        const ref = reference(uid, item);
        const snap = await tx.get(ref);
        const merged = mergeBackupDocument(item.kind, snap.exists() ? snap.data() : null, item.data);
        if (!merged.changed) return false;
        tx.set(ref, { ...merged.data, ...(["nutrition-log", "supplement-log", "nutrition-note"].includes(item.kind) ? { date: item.id } : {}), updated_at: serverTimestamp(), ...(item.kind === "nutrition-log" ? {
          micro_totals: deleteField(), micro_totals_complete: deleteField(),
        } : {}) });
        return true;
      });
      if (applied) changed++;
      onProgress(++completed, backup.documents.length);
    }
  } catch (error) {
    throw new Error(`Wiederherstellung nach ${completed}/${backup.documents.length} Dokumenten unterbrochen: ${error.message} Bereits ergänzte Daten bleiben erhalten; erneutes Ausführen ist möglich.`);
  }
  return { completed, changed };
}
