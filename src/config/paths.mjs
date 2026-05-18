import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");

export const DATA_DIR = process.env.AOS_FUEL_DATA_DIR
  ? path.resolve(process.env.AOS_FUEL_DATA_DIR)
  : path.join(process.env.HOME || process.env.USERPROFILE, ".aos", "fuel");

export const REPO_DATA_DIR = path.join(ROOT, "data"); // Kataloge im Repo
export const PUBLIC_DIR = path.join(ROOT, "public"); // V1 vanilla HTML
export const VITE_BUILD_DIR = process.env.FUEL_BUILD_DIR ? path.resolve(process.env.FUEL_BUILD_DIR) : path.join(ROOT, "dist"); // V2 React build output
export const STATIC_DIR = process.env.FUEL_STATIC_DIR ? path.resolve(process.env.FUEL_STATIC_DIR) : PUBLIC_DIR; // Legacy compat

export const FUEL_DIR = path.join(DATA_DIR, "fuel");
export const NUTRITION_DIR = path.join(DATA_DIR, "nutrition");
export const NUTRITION_JOURNAL_DIR = path.join(DATA_DIR, "nutrition_journal");
export const NUTRITION_CATALOG_PATH = path.join(ROOT, "catalogs", "nutrition", "catalog.json"); // Repo-basiert
export const NUTRITION_MICROS_CATALOG_PATH = path.join(ROOT, "catalogs", "nutrition", "micros-catalog.json");
export const SUPPLEMENTS_DIR = path.join(DATA_DIR, "supplements");
export const SUPPLEMENTS_LOG_DIR = path.join(SUPPLEMENTS_DIR, "logs");
export const SUPPLEMENTS_CATALOG_PATH = path.join(ROOT, "catalogs", "supplements", "catalog.json"); // Repo-basiert

export function initializePaths() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FUEL_DIR)) fs.mkdirSync(FUEL_DIR, { recursive: true });
  if (!fs.existsSync(NUTRITION_DIR)) fs.mkdirSync(NUTRITION_DIR, { recursive: true });
  if (!fs.existsSync(NUTRITION_JOURNAL_DIR)) fs.mkdirSync(NUTRITION_JOURNAL_DIR, { recursive: true });
  if (!fs.existsSync(SUPPLEMENTS_DIR)) fs.mkdirSync(SUPPLEMENTS_DIR, { recursive: true });
  if (!fs.existsSync(SUPPLEMENTS_LOG_DIR)) fs.mkdirSync(SUPPLEMENTS_LOG_DIR, { recursive: true });
}
