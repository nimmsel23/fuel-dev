import { readYamlFile, writeYamlFile } from "../lib/file-io.mjs";
import { slugifyId } from "../../shared/utils/ids.mjs";
import { SUPPLEMENTS_CATALOG_PATH } from "../config/paths.mjs";
import { pushSupplementsCatalog } from "../lib/firestore-admin.mjs";

const CATALOG_DEFAULTS = {
  version: 1,
  updated_at: new Date().toISOString(),
  items: [],
};

export function loadCatalog() {
  const catalog = readYamlFile(SUPPLEMENTS_CATALOG_PATH, CATALOG_DEFAULTS);
  if (!catalog.items) catalog.items = [];
  return catalog;
}

export function saveCatalog(catalog) {
  catalog.updated_at = new Date().toISOString();
  writeYamlFile(SUPPLEMENTS_CATALOG_PATH, catalog);
  // Fire-and-forget Firestore push
  pushSupplementsCatalog(catalog.items || []).catch(() => {});
}

export function addOrUpdateSupplement(catalog, input) {
  const name = (input.name || "").toString().trim();
  if (!name) return null;

  const id = input.id || slugifyId(name, "supp");
  const unit = (input.unit || "mg").toString().trim() || "mg";
  const defaultDose = input.default_dose == null ? null : Number(input.default_dose);
  const defaultTime = (input.default_time_of_day || "any").toString().trim() || "any";

  const item = {
    id,
    name,
    unit,
    default_dose: defaultDose,
    default_time_of_day: defaultTime,
    // schedule war früher nie Teil dieses Objekts — GeminiCatalogModal.jsx
    // schätzte es längst, aber es wurde beim Speichern verworfen.
    // Supplements/utils.js:isDueToday() (genutzt von DailyChecklist.jsx)
    // hing dadurch komplett in der Luft (2026-07-30 entdeckt).
    schedule: input.schedule ?? null,
  };

  const idx = catalog.items.findIndex((i) => i.id === id);
  if (idx >= 0) {
    catalog.items[idx] = item;
  } else {
    catalog.items.push(item);
  }

  return item;
}

export function deleteSupplement(catalog, id) {
  const idx = catalog.items.findIndex((i) => i.id === id);
  if (idx < 0) return false;
  catalog.items.splice(idx, 1);
  return true;
}
