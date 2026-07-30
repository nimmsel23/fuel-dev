import path from "path";
import { readJsonFile, writeJsonFile } from "../lib/file-io.mjs";
import { randomId } from "../../shared/utils/ids.mjs";
import { SUPPLEMENTS_LOG_DIR } from "../config/paths.mjs";
import { pushSupplementLog } from "../lib/firestore-admin.mjs";

function getLogPath(date) {
  return path.join(SUPPLEMENTS_LOG_DIR, `${date}.json`);
}

export function loadLog(date) {
  const filePath = getLogPath(date);
  const log = readJsonFile(filePath, {
    date,
    intakes: [],
  });
  if (!log.intakes) log.intakes = [];
  return log;
}

export function saveLog(log) {
  const filePath = getLogPath(log.date);
  log.updated_at = new Date().toISOString();
  writeJsonFile(filePath, log);
  // Fire-and-forget push
  pushSupplementLog(log.date, log).catch(() => {});
}

export function addIntake(log, intakeInput) {
  const supplementId = (intakeInput.supplement_id || "").toString().trim();
  const name = (intakeInput.name || supplementId).toString().trim();
  if (!supplementId || !name) return null;

  const dose = intakeInput.dose == null ? null : Number(intakeInput.dose);
  const unit = (intakeInput.unit || "mg").toString().trim() || "mg";
  const timeOfDay = (intakeInput.time_of_day || "any").toString().trim() || "any";
  const notes = (intakeInput.notes || "").toString().trim();

  const intake = {
    id: randomId("supp"),
    supplement_id: supplementId,
    name,
    dose,
    unit,
    time_of_day: timeOfDay,
    notes,
    time: new Date().toISOString(),
  };

  log.intakes.push(intake);
  return intake;
}

export function updateIntake(log, intakeId, updates) {
  const idx = log.intakes.findIndex((i) => i.id === intakeId);
  if (idx < 0) return null;

  const current = log.intakes[idx];
  const merged = { ...current };
  if (updates.dose !== undefined) merged.dose = updates.dose == null ? null : Number(updates.dose);
  if (updates.unit !== undefined) merged.unit = (updates.unit || current.unit).toString().trim();
  if (updates.time_of_day !== undefined) merged.time_of_day = (updates.time_of_day || current.time_of_day).toString().trim();
  if (updates.notes !== undefined) merged.notes = (updates.notes || "").toString().trim();
  if (updates.name !== undefined) merged.name = (updates.name || current.name).toString().trim();

  log.intakes[idx] = merged;
  return merged;
}

export function deleteIntake(log, intakeId) {
  const idx = log.intakes.findIndex((i) => i.id === intakeId);
  if (idx >= 0) {
    log.intakes.splice(idx, 1);
    return true;
  }
  return false;
}
