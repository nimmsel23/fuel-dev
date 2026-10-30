import { openDB } from "idb";

const MAX_PHOTOS = 12;
const MAX_BYTES = 8 * 1024 * 1024;
let database;
const dbPromise = () => database ||= openDB("fuel-scan-drafts-v1", 1, {
  upgrade(db) { db.createObjectStore("drafts", { keyPath: "id" }); },
});

// The caller supplies the authenticated owner, never a shared anonymous bucket.
export function createScanQueue(getOwner, getDB = dbPromise) {
  const assertOwner = owner => {
    if (!owner || getOwner() !== owner) throw new Error("Bitte mit demselben Konto anmelden, um das Foto fortzusetzen.");
  };
  return {
    async list(owner) {
      assertOwner(owner);
      const db = await getDB();
      const entries = await db.getAll("drafts");
      assertOwner(owner);
      return entries.filter(entry => entry.owner === owner).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async add(owner, file, date, scanType) {
      assertOwner(owner);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !["food", "label"].includes(scanType)) throw new Error("Ungültiger Foto-Tag oder Scan-Typ.");
      if (!file?.type?.startsWith("image/") || !file.size || file.size > MAX_BYTES) {
        throw new Error("Bitte ein Bild bis 8 MB wählen, um es für später zu sichern.");
      }
      const db = await getDB();
      assertOwner(owner);
      const tx = db.transaction("drafts", "readwrite");
      const entries = await tx.store.getAll();
      assertOwner(owner);
      if (entries.filter(entry => entry.owner === owner).length >= MAX_PHOTOS) {
        tx.abort();
        await tx.done.catch(() => {});
        throw new Error("Die Foto-Warteliste ist voll (12 Fotos). Bitte zuerst Fotos übernehmen oder entfernen.");
      }
      const entry = { id: crypto.randomUUID(), owner, file, date, scanType, createdAt: new Date().toISOString() };
      await tx.store.put(entry);
      await tx.done;
      assertOwner(owner);
      return entry;
    },
    async remove(owner, id) {
      assertOwner(owner);
      const db = await getDB();
      assertOwner(owner);
      const tx = db.transaction("drafts", "readwrite");
      const entry = await tx.store.get(id);
      assertOwner(owner);
      if (entry?.owner === owner) await tx.store.delete(id);
      await tx.done;
      assertOwner(owner);
    },
  };
}
