import { z } from "zod";

export const BACKUP_KINDS = ["nutrition-log", "nutrition-note", "nutrition-catalog", "supplement-log", "supplement-catalog", "settings", "fuel-frame"];
const dataSchema = z.record(z.unknown());
const schema = z.object({
  format: z.literal("fuel-backup"), version: z.literal(1),
  uid: z.string().min(1).max(128).regex(/^[^/]+$/), exportedAt: z.string().datetime(),
  documents: z.array(z.object({ kind: z.enum(BACKUP_KINDS), id: z.string().min(1).max(128), data: dataSchema }).strict()).max(5000),
}).strict();
const arrayField = kind => kind === "nutrition-log" ? "meals" : kind === "supplement-log" ? "intakes" : kind.endsWith("catalog") ? "items" : kind === "nutrition-note" ? "ai_pending" : null;
const tombstoneField = kind => kind === "nutrition-log" ? "deleted_meal_ids" : kind === "supplement-log" ? "deleted_intake_ids" : kind.endsWith("catalog") ? "deleted_ids" : null;

function checkJson(value, depth = 0) {
  if (depth > 30) throw new Error("Backup ist zu tief verschachtelt.");
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value !== "object") throw new Error("Backup enthält ungültige Werte.");
  for (const [key, child] of Object.entries(value)) {
    if (["__proto__", "constructor", "prototype", "setSetting", "hydrateFromCloud"].includes(key)) throw new Error("Backup enthält unzulässige Felder.");
    checkJson(child, depth + 1);
  }
}

export function validateBackup(input, uid) {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error("Keine gültige Fuel-Backup-Datei (Version 1).");
  const backup = result.data;
  if (backup.uid !== uid) throw new Error("Dieses Backup gehört zu einem anderen Konto. Bitte mit dem ursprünglichen Konto anmelden.");
  checkJson(backup);
  if (new TextEncoder().encode(JSON.stringify(backup)).length > 10 * 1024 * 1024) throw new Error("Backup ist größer als 10 MB.");
  const seen = new Set();
  for (const item of backup.documents) {
    const key = `${item.kind}/${item.id}`;
    if (seen.has(key)) throw new Error("Backup enthält doppelte Dokumente.");
    seen.add(key);
    if (["nutrition-log", "supplement-log", "nutrition-note"].includes(item.kind)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.id) || !Number.isFinite(Date.parse(item.id)) || new Date(item.id).toISOString().slice(0, 10) !== item.id) throw new Error("Backup enthält ein ungültiges Tagesdatum.");
      if (item.data.date !== undefined && item.data.date !== item.id) throw new Error("Datum im Backup widerspricht der Dokument-ID.");
    } else if (item.id !== (item.kind.endsWith("catalog") ? "catalog" : item.kind === "settings" ? "settings" : "fuelFrame")) throw new Error("Ungültige Dokument-ID im Backup.");
    const field = arrayField(item.kind);
    if (field && item.data[field] !== undefined) {
      if (!Array.isArray(item.data[field])) throw new Error(`Backup-Feld ${field} ist keine Liste.`);
      const ids = new Set();
      for (const entry of item.data[field]) {
        if (!entry || typeof entry !== "object" || typeof entry.id !== "string" || !entry.id || ids.has(entry.id)) throw new Error(`Ungültige oder doppelte Eintrags-ID in ${field}.`);
        ids.add(entry.id);
        for (const metric of ["kcal", "protein", "carbs", "fat", "grams", "dose"]) {
          if (entry[metric] != null && (!Number.isFinite(Number(entry[metric])) || Number(entry[metric]) < 0)) throw new Error("Backup enthält ungültige Nährwerte / Mengen.");
        }
        if (item.kind === "nutrition-log" && typeof entry.description !== "string") throw new Error("Mahlzeitenbeschreibung fehlt im Backup.");
        if (item.kind.endsWith("catalog") && typeof entry.name !== "string") throw new Error("Katalogname fehlt im Backup.");
      }
    }
    const tombstones = tombstoneField(item.kind);
    if (tombstones && item.data[tombstones] !== undefined && (!Array.isArray(item.data[tombstones]) || item.data[tombstones].some(id => typeof id !== "string"))) throw new Error("Ungültige Löschmarkierungen im Backup.");
    if (new TextEncoder().encode(JSON.stringify(item.data)).length > 800000) throw new Error("Ein Backup-Dokument ist zu groß.");
  }
  return backup;
}

export function portableData(value) {
  if (value?.toDate instanceof Function) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(portableData);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !["updated_at", "cached_at", "micro_totals", "micro_totals_complete"].includes(key))
    .map(([key, child]) => [key, portableData(child)]));
  return value;
}

// Additive restore: current entries/fields win; tombstones prevent resurrection.
export function mergeBackupDocument(kind, current, incoming) {
  const old = current ? portableData(current) : {};
  const restored = portableData(incoming);
  const next = { ...restored, ...old };
  const field = arrayField(kind), tombstones = tombstoneField(kind);
  let addedEntries = 0;
  if (field) {
    const existing = old[field] || [];
    const ids = new Set(existing.map(i => i.id));
    const deleted = new Set(tombstones ? [...(old[tombstones] || []), ...(restored[tombstones] || [])] : []);
    // Existing records always win, including ones intentionally restored later.
    const additions = (restored[field] || []).filter(i => !ids.has(i.id) && !deleted.has(i.id));
    addedEntries = additions.length;
    if (old[field] !== undefined || restored[field] !== undefined) next[field] = [...existing, ...additions];
    if (tombstones && (old[tombstones] || restored[tombstones])) next[tombstones] = [...deleted].filter(id => !ids.has(id));
  }
  return { data: next, addedEntries, changed: !current || stableJson(old) !== stableJson(next) };
}

export function summarizeBackup(backup) {
  const result = {};
  for (const document of backup.documents) result[document.kind] = (result[document.kind] || 0) + 1;
  return result;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
