import fs from "fs";
import path from "path";
import YAML from "yaml";
import { NUTRITION_MEALS_DIR } from "../config/paths.mjs";
import { slugifyId } from "../../shared/utils/ids.mjs";
import { pushNutritionCatalog } from "../lib/firestore-admin.mjs";
import { verifyCatalogItemAsync } from "./nutrition-catalog-verify.mjs";

function mealPath(id, ext = ".yaml") {
  return path.join(NUTRITION_MEALS_DIR, `${id}${ext}`);
}

function normalizeName(name) {
  return String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function sortCatalogItems(items) {
  return items.sort((a, b) => {
    const aRecent = a.last_used_at || a.updated_at || "";
    const bRecent = b.last_used_at || b.updated_at || "";
    if (aRecent !== bRecent) return bRecent.localeCompare(aRecent);
    return (a.name || "").localeCompare(b.name || "");
  });
}

export function loadCatalog() {
  if (!fs.existsSync(NUTRITION_MEALS_DIR)) fs.mkdirSync(NUTRITION_MEALS_DIR, { recursive: true });
  
  // Support .yaml and .json — skip tombstones (.deleted) and backups (.bak)
  const files = fs.readdirSync(NUTRITION_MEALS_DIR).filter((f) =>
    (f.endsWith(".yaml") || f.endsWith(".yml") || f.endsWith(".json")) &&
    !f.includes(".deleted") && !f.includes(".bak")
  );
  
  const items = [];
  const seenIds = new Set();

  for (const file of files) {
    const ext = path.extname(file);
    const id = path.basename(file, ext);
    
    // If we have both .yaml and .json for the same ID, prefer .yaml
    if (seenIds.has(id) && (ext === ".json")) continue;
    
    try {
      const raw = fs.readFileSync(path.join(NUTRITION_MEALS_DIR, file), "utf-8");
      let data;
      if (ext === ".json") {
        data = JSON.parse(raw);
      } else {
        data = YAML.parse(raw);
      }
      items.push(data);
      seenIds.add(id);
    } catch (e) {
      console.warn(`[nutrition-catalog] skip corrupt file ${file}:`, e.message);
    }
  }
  return { items: sortCatalogItems(items) };
}

export function loadMeal(id) {
  // Check YAML first, then JSON
  const pYaml = mealPath(id, ".yaml");
  const pYml = mealPath(id, ".yml");
  const pJson = mealPath(id, ".json");

  if (fs.existsSync(pYaml)) {
    try { return YAML.parse(fs.readFileSync(pYaml, "utf-8")); } catch { return null; }
  }
  if (fs.existsSync(pYml)) {
    try { return YAML.parse(fs.readFileSync(pYml, "utf-8")); } catch { return null; }
  }
  if (fs.existsSync(pJson)) {
    try { return JSON.parse(fs.readFileSync(pJson, "utf-8")); } catch { return null; }
  }
  return null;
}

export function saveMeal(item) {
  if (!fs.existsSync(NUTRITION_MEALS_DIR)) fs.mkdirSync(NUTRITION_MEALS_DIR, { recursive: true });

  item.updated_at = new Date().toISOString();

  // Always save as .yaml
  const p = mealPath(item.id, ".yaml");
  fs.writeFileSync(p, YAML.stringify(item, { indent: 2 }), "utf-8");

  // If a legacy .json exists, tombstone it
  const pJson = mealPath(item.id, ".json");
  if (fs.existsSync(pJson)) {
    try { fs.renameSync(pJson, `${pJson}.deleted`); } catch {}
  }

  // If a tombstone exists for this id, remove it (meal was un-deleted by re-save)
  for (const ext of [".yaml", ".yml", ".json"]) {
    const tomb = mealPath(item.id, `${ext}.deleted`);
    if (fs.existsSync(tomb)) { try { fs.unlinkSync(tomb); } catch {} }
  }

  // Fire-and-forget push to Firestore
  const catalog = loadCatalog();
  pushNutritionCatalog(catalog.items).catch(() => {});

  // Neuer oder noch nie geprüfter Eintrag → Haiku+WebSearch-Verifikation
  // im Hintergrund anstoßen (verify-one setzt verified_at, kein Retrigger
  // bei jedem erneuten Loggen desselben Meals).
  if (!item.verified_at) {
    verifyCatalogItemAsync(item.id);
  }

  return item;
}

export function deleteMeal(id) {
  let deleted = false;
  for (const ext of [".yaml", ".yml", ".json"]) {
    const p = mealPath(id, ext);
    if (!fs.existsSync(p)) continue;
    const tombstone = `${p}.deleted`;
    try {
      fs.renameSync(p, tombstone);
      deleted = true;
      console.log(`[nutrition-catalog] 🪦  ${path.basename(p)} → ${path.basename(tombstone)}`);
    } catch (e) {
      console.warn(`[nutrition-catalog] tombstone rename failed for ${p}:`, e.message);
    }
  }
  if (deleted) {
    // Push updated catalog (without the deleted meal) to Firestore
    const catalog = loadCatalog();
    pushNutritionCatalog(catalog.items).catch(() => {});
  }
}

// IDs aller lokal tombstoned Meals — Grundlage für pushNutritionCatalog()'s
// Merge (eine lokale Löschung muss auch dann gewinnen, wenn Firestore die ID
// zwischenzeitlich wieder enthält, z.B. weil sie während lokaler Downtime
// über die Cloud-UI neu angelegt wurde).
export function listDeletedMealIds() {
  if (!fs.existsSync(NUTRITION_MEALS_DIR)) return [];
  return fs.readdirSync(NUTRITION_MEALS_DIR)
    .filter((f) => f.includes(".deleted"))
    .map((f) => path.basename(f.replace(/\.(yaml|yml|json)\.deleted$/, "")));
}

export function normalizeMeal(input, existingId = null) {
  const name = (input.name || input.description || "").toString().trim();
  if (!name) return null;

  const id = existingId || input.id || slugifyId(name, "meal");

  return {
    id,
    kind:             input.kind || "meal",
    category:         input.category || "meal",
    name,
    alias:            input.alias || null,
    meal_type:        input.meal_type || "meal",
    description:      input.description || name,
    notes:            input.notes || "",
    kcal:             Math.max(0, Math.round((input.kcal ?? 0) * 10) / 10),
    protein:          Math.max(0, Math.round((input.protein ?? 0) * 10) / 10),
    carbs:            Math.max(0, Math.round((input.carbs ?? 0) * 10) / 10),
    fat:              Math.max(0, Math.round((input.fat ?? 0) * 10) / 10),
    yield_g:          input.yield_g || null,
    components:            input.components || [],
    addons:                input.addons || [],
    default_addon_ids:     input.default_addon_ids || [],
    linked_supplement_ids: input.linked_supplement_ids || [],
    source:                input.source || "manual",
    use_count:             Math.max(1, Number(input.use_count || 1)),
    last_used_at:          input.last_used_at || input.updated_at || new Date().toISOString(),
    created_at:            input.created_at || new Date().toISOString(),
    updated_at:            new Date().toISOString(),
    // Haiku+WebSearch-Verifikation gegen Herstellerangaben — null bis zum
    // ersten erfolgreichen Check (verify-one setzt das Datum, egal ob Treffer
    // oder nicht, damit nicht bei jedem erneuten Loggen erneut geprüft wird).
    verified_at:           input.verified_at || null,
  };
}

export function addOrUpdateItem(catalog, input) {
  const inputName = normalizeName(input.name);
  const existing = catalog.items.find(
    (i) => i.id === input.id || normalizeName(i.name) === inputName
  );
  const item = normalizeMeal(input, existing?.id);
  if (!item) return null;
  if (existing) {
    item.created_at = existing.created_at;
    item.verified_at = existing.verified_at || null;
  }
  saveMeal(item);
  return item;
}

// Legacy compat — catalog.items is built on the fly, no save needed
export function saveCatalog(_catalog) { /* no-op: individual files are saved directly */ }

export function upsertLoggedMeal(catalog, mealInput) {
  const mealName = mealInput?.description || mealInput?.name;
  const inputName = normalizeName(mealName);
  if (!inputName) return null;

  const existing = catalog.items.find(
    (i) => (mealInput?.catalog_id && i.id === mealInput.catalog_id) || normalizeName(i.name) === inputName
  );
  const lastUsedAt = mealInput?.time || mealInput?.logged_at || new Date().toISOString();
  const next = normalizeMeal({
    ...existing,
    id: existing?.id || mealInput?.catalog_id,
    kind: existing?.kind || "meal",
    category: existing?.category || mealInput?.type || existing?.meal_type || "meal",
    name: mealName,
    alias: existing?.alias || null,
    meal_type: mealInput?.type || existing?.meal_type || "meal",
    description: mealInput?.description || mealInput?.name || existing?.description || "",
    notes: mealInput?.notes ?? existing?.notes ?? "",
    kcal: mealInput?.kcal ?? mealInput?.calories ?? existing?.kcal ?? 0,
    protein: mealInput?.protein ?? existing?.protein ?? 0,
    carbs: mealInput?.carbs ?? existing?.carbs ?? 0,
    fat: mealInput?.fat ?? existing?.fat ?? 0,
    yield_g: existing?.yield_g || null,
    components: existing?.components || [],
    addons: existing?.addons || [],
    default_addon_ids: existing?.default_addon_ids || [],
    linked_supplement_ids: existing?.linked_supplement_ids || [],
    source: existing?.source || mealInput?.source || "logged",
    use_count: (existing?.use_count || 0) + 1,
    last_used_at: lastUsedAt,
    created_at: existing?.created_at,
  }, existing?.id || mealInput?.catalog_id || null);
  if (!next) return null;
  saveMeal(next);
  return next;
}
