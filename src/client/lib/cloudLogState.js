// Pure state transition, shared by online transactions and conflict tests.
export function changeLog(kind, current, command) {
  const log = { ...current };
  const key = kind === "nutrition" ? "meals" : "intakes";
  const tombstones = kind === "nutrition" ? "deleted_meal_ids" : "deleted_intake_ids";
  const id = command.meal_id || command.intake_id;
  const deleted = command.delete_meal_id || command.delete_id;
  let entries = [...(log[key] || [])];
  if (deleted) {
    entries = entries.filter(i => i.id !== deleted);
    log[tombstones] = [...new Set([...(log[tombstones] || []), deleted])];
  } else if (id) {
    if (!entries.some(i => i.id === id)) throw new Error("Eintrag wurde inzwischen gelöscht oder verschoben.");
    entries = entries.map(i => i.id === id ? { ...i, ...(command.meal || command.updates), id } : i);
  } else {
    const entry = command.meal || command.intake;
    if (entry && !entries.some(i => i.id === entry.id) && !(log[tombstones] || []).includes(entry.id)) entries.push(entry);
  }
  log[key] = entries;
  if (kind === "nutrition") {
    if (command.water_delta !== undefined) log.water_ml = Math.max(0, Math.round((Number(log.water_ml) || 0) + Number(command.water_delta)));
    else if (command.water_ml !== undefined) log.water_ml = Math.max(0, Math.round(Number(command.water_ml)));
    if (!Number.isFinite(log.water_ml ?? 0)) throw new Error("Ungültige Wassermenge.");
    delete log.micro_totals;
    delete log.micro_totals_complete;
  }
  return log;
}
