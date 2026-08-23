import fs from "fs";
import path from "path";
import { NUTRITION_DIR, SUPPLEMENTS_LOG_DIR } from "../config/paths.mjs";

function readJson(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch {}
  return fallback;
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function nutritionTombPath(date) {
  return path.join(NUTRITION_DIR, `${date}.deleted.json`);
}

function supplementsTombPath(date) {
  return path.join(SUPPLEMENTS_LOG_DIR, `${date}.deleted.json`);
}

function loadIds(filePath, key) {
  const data = readJson(filePath, { [key]: [] });
  return Array.isArray(data[key]) ? data[key].filter(Boolean) : [];
}

function saveIds(filePath, key, ids) {
  const unique = Array.from(new Set((ids || []).filter(Boolean)));
  if (unique.length === 0) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return;
  }
  writeJson(filePath, {
    [key]: unique,
    updated_at: new Date().toISOString(),
  });
}

export function getDeletedMealIds(date) {
  return loadIds(nutritionTombPath(date), "deleted_meal_ids");
}

export function addDeletedMealIds(date, ids) {
  saveIds(nutritionTombPath(date), "deleted_meal_ids", [...getDeletedMealIds(date), ...(ids || [])]);
}

export function addDeletedMealId(date, id) {
  addDeletedMealIds(date, [id]);
}

export function removeDeletedMealId(date, id) {
  saveIds(nutritionTombPath(date), "deleted_meal_ids", getDeletedMealIds(date).filter((x) => x !== id));
}

export function getDeletedIntakeIds(date) {
  return loadIds(supplementsTombPath(date), "deleted_intake_ids");
}

export function addDeletedIntakeIds(date, ids) {
  saveIds(supplementsTombPath(date), "deleted_intake_ids", [...getDeletedIntakeIds(date), ...(ids || [])]);
}

export function addDeletedIntakeId(date, id) {
  addDeletedIntakeIds(date, [id]);
}

export function removeDeletedIntakeId(date, id) {
  saveIds(supplementsTombPath(date), "deleted_intake_ids", getDeletedIntakeIds(date).filter((x) => x !== id));
}
