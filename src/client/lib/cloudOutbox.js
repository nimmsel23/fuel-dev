import { getUid } from "./db/firestore/core.js";
import { mutateCloudLog } from "./cloudMutations.js";
import { changeLog } from "./cloudLogState.js";

const PREFIX = "fuel:outbox:v1:";
export const OUTBOX_EVENT = "fuel:outbox-changed";
const notify = entry => window.dispatchEvent(Object.assign(new Event(OUTBOX_EVENT), { entry }));
const keyFor = (uid, id) => `${PREFIX}${uid}:${id}`;
const transient = e => ["unavailable", "deadline-exceeded", "aborted"].includes(String(e.code || "").replace("firestore/", ""));

export function outboxEntries(uid) {
  if (!uid) return [];
  const prefix = `${PREFIX}${uid}:`;
  return Object.keys(localStorage).filter(k => k.startsWith(prefix)).map(k => JSON.parse(localStorage.getItem(k)))
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

// One key per command prevents tabs overwriting each other's queued work.
// Storage errors propagate: never acknowledge an unpersisted command.
function save(entry) {
  localStorage.setItem(keyFor(entry.uid, entry.id), JSON.stringify(entry));
  notify(entry);
}

async function execute(entry) {
  if (getUid() !== entry.uid) throw new Error("Konto hat gewechselt; ausstehende Änderung bleibt beim ursprünglichen Konto.");
  try {
    const data = await mutateCloudLog(entry.kind, entry.date, { ...entry.command, operation_id: entry.id });
    localStorage.removeItem(keyFor(entry.uid, entry.id));
    notify(entry);
    return { ok: true, data };
  } catch (error) {
    save({ ...entry, error: error.message, blocked: !transient(error) });
    throw error;
  }
}

async function locked(uid, work) {
  if (navigator.locks) return navigator.locks.request(`fuel-outbox:${uid}`, work);
  return work(); // Firestore receipts also deduplicate parallel replay.
}

export async function submitCloudLog(kind, date, command, { background = false } = {}) {
  const uid = getUid();
  const entry = { uid, id: crypto.randomUUID(), kind, date, command,
    targetMeal: command.source_meal ? { ...command.source_meal, ...command.meal, id: command.move_id } : null,
    createdAt: performance.timeOrigin + performance.now() };
  save(entry);
  if (!navigator.onLine) return { ok: true, queued: true };
  if (background) {
    // Acknowledge durable local storage immediately, then drain in intent order.
    // Errors remain on the persisted entry and are surfaced by StorageStatus.
    void flushCloudOutbox().catch(() => {});
    return { ok: true, queued: true };
  }
  return locked(uid, async () => {
    // Preserve intent order: a failed earlier edit must not be overtaken.
    const earlier = outboxEntries(uid).find(e => e.id !== entry.id);
    if (earlier) return { ok: true, queued: true };
    try { return await execute(entry); }
    catch (error) {
      if (transient(error)) return { ok: true, queued: true };
      throw error;
    }
  });
}

export async function flushCloudOutbox() {
  const uid = getUid();
  return locked(uid, async () => {
    for (const entry of outboxEntries(uid)) {
      if (!navigator.onLine || getUid() !== uid) break;
      await execute(entry);
    }
  });
}

export function discardCloudOperation(id) {
  const entry = outboxEntries(getUid()).find(entry => entry.id === id);
  localStorage.removeItem(keyFor(getUid(), id));
  notify(entry);
}

export function projectCloudLog(kind, date, data) {
  let projected = { ...data };
  for (const entry of outboxEntries(getUid())) {
    if (entry.kind !== kind || entry.blocked) continue;
    const c = entry.command;
    try {
      if (entry.date === date) {
        projected = changeLog(kind, projected, c);
        if (c.new_date && c.new_date !== date) projected.meals = projected.meals.filter(m => m.id !== c.meal_id);
      } else if (c.new_date === date && entry.targetMeal) {
        projected = changeLog(kind, projected, { meal: entry.targetMeal });
      }
    } catch { /* A conflict is shown on replay; do not invent a successful edit. */ }
  }
  return projected;
}
