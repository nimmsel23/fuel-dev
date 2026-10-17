// Reine Logik (kein Firebase-Import) für die Outbox-Einträge jenseits der Tageslogs:
// Katalog-Änderungen, Notizen, Mikros. Alle Operationen sind idempotent — ein wiederholter Replay
// (Absturz mitten im Flush, zwei Tabs) ergibt dasselbe Ergebnis wie ein einmaliger.
//
// Outbox-Arten (entry.kind):
//   "nutrition" | "supplements"     Tageslogs (cloudMutations.mutateCloudLog, hier nicht behandelt)
//   "catalog:nutrition" | "catalog:supplements"   command = { op: "upsert", item, matchName? } | { op: "delete", id }
//   "notes"                          command = { content }           (entry.date = Tag)
//   "micros"                         command = { items: [...] }

export const LOG_KINDS = ["nutrition", "supplements"];
export const isLogKind = kind => LOG_KINDS.includes(kind);

export const normalizeName = n => String(n || "").trim().toLowerCase().replace(/\s+/g, " ");

// Reihenfolge-Strom eines Eintrags: Logs behalten die globale Absichts-Reihenfolge (wie bisher),
// alle anderen Arten blockieren sich nur untereinander — ein hängender Katalogeintrag hält keine Mahlzeit auf.
export const streamOf = entry => (isLogKind(entry.kind) ? "log" : entry.kind === "notes" ? `notes:${entry.date}` : entry.kind);

export function applyCatalogOp(items, op) {
  const list = [...(items || [])];
  if (op.op === "delete") return list.filter(i => i.id !== op.id);
  if (op.op !== "upsert" || !op.item) throw new Error("Ungültige Katalog-Änderung.");
  const idx = list.findIndex(i => i.id === op.item.id || (op.matchName && normalizeName(i.name) === normalizeName(op.item.name)));
  if (idx >= 0) list[idx] = { ...op.item, id: list[idx].id }; // bestehende ID behalten (Name-Treffer)
  else list.push(op.item);
  return list;
}

// Eingehende Mikros-Schätzungen ersetzen gleichnamige (meal_name), neue werden angehängt.
export function mergeMicros(existing, incoming) {
  const byName = new Map((incoming || []).map(i => [i.meal_name, i]));
  const merged = (existing || []).map(i => (byName.has(i.meal_name) ? byName.get(i.meal_name) : i));
  for (const item of incoming || []) if (!(existing || []).some(i => i.meal_name === item.meal_name)) merged.push(item);
  return merged;
}

// Optimistische Lese-Sicht: noch nicht bestätigte Einträge auf den gelesenen Stand anwenden.
// Geblockte (dauerhaft fehlgeschlagene) Einträge zeigen wir nicht als erfolgreich.
export function projectCatalogItems(kind, items, entries) {
  return entries.filter(e => e.kind === `catalog:${kind}` && !e.blocked).reduce((acc, e) => {
    try { return applyCatalogOp(acc, e.command); } catch { return acc; }
  }, items || []);
}

export function projectNotesContent(content, date, entries) {
  const pending = entries.filter(e => e.kind === "notes" && e.date === date && !e.blocked);
  return pending.length ? pending[pending.length - 1].command.content : content;
}
