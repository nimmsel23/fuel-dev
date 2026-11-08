import { scaleKnownMicros } from "./knownMicros.js";

function knownNumber(value) {
  if (value == null || typeof value === "boolean") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return number;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function scaleKnown(value, factor) {
  const number = knownNumber(value);
  return number == null ? null : round1(number * factor);
}

function addonMacro(addons, key) {
  let total = 0;
  for (const addon of addons) {
    const number = knownNumber(addon?.[key]);
    if (number == null) return null;
    total += number;
  }
  return total;
}

function combineMacro(base, extra, factor) {
  const baseNumber = knownNumber(base);
  const extraNumber = knownNumber(extra);
  if (baseNumber == null || extraNumber == null) return null;
  return round1((baseNumber + extraNumber) * factor);
}

const COMPONENT_SCALED_KEYS = ["amount_g", "grams", "kcal", "protein", "carbs", "fat"];

function snapshotComponent(component, factor) {
  const copy = structuredClone(component);
  for (const key of COMPONENT_SCALED_KEYS) {
    if (key in copy) copy[key] = scaleKnown(copy[key], factor);
  }
  if (copy.micros && typeof copy.micros === "object") copy.micros = scaleKnownMicros(copy.micros, factor);
  return copy;
}

function snapshotMicros(item, addons, factor) {
  const base = item?.micros && typeof item.micros === "object" ? scaleKnownMicros(item.micros, factor) : {};
  for (const addon of addons) {
    const extra = scaleKnownMicros(addon?.micros, factor);
    for (const key of Object.keys(base)) {
      if (Object.prototype.hasOwnProperty.call(extra, key)) base[key] = round1(base[key] + extra[key]);
    }
  }
  return base;
}

// Eine geloggte Katalogmahlzeit trägt ihre damaligen Werte selbst. Spätere
// Änderungen am Katalogeintrag dürfen diese Kopie nicht mehr verändern.
export function mealFromCatalogItem(item, { addonIds = [], grams = null } = {}) {
  const yieldG = knownNumber(item?.yield_g);
  const requested = knownNumber(grams);
  const factor = yieldG > 0 && requested > 0 ? requested / yieldG : 1;
  const selected = new Set(addonIds || []);
  const addons = (Array.isArray(item?.addons) ? item.addons : []).filter((addon) => addon && selected.has(addon.id));
  const labels = addons.map((addon) => String(addon.label || "").trim()).filter(Boolean);
  const notes = [item?.notes, labels.length ? `Add-ons: ${labels.join(", ")}` : ""].filter(Boolean).join("\n");
  const components = (Array.isArray(item?.components) ? item.components : []).filter((component) => component && typeof component === "object").map((component) => snapshotComponent(component, factor));
  return {
    type: item?.meal_type || item?.type || "meal",
    description: item?.name || item?.description || "",
    notes,
    grams: requested > 0 ? requested : (yieldG > 0 ? yieldG : null),
    catalog_id: item?.id || null,
    catalog_item_id: item?.id || null,
    source: "catalog",
    kcal: combineMacro(item?.kcal, addonMacro(addons, "kcal"), factor),
    protein: combineMacro(item?.protein, addonMacro(addons, "protein"), factor),
    carbs: combineMacro(item?.carbs, addonMacro(addons, "carbs"), factor),
    fat: combineMacro(item?.fat, addonMacro(addons, "fat"), factor),
    components,
    components_snapshot: true,
    micros: snapshotMicros(item, addons, factor),
    micros_snapshot: true,
    micros_meta: {
      source: item?.micros_meta?.source || "catalog",
      origin: "logged_snapshot",
      scaling_factor: round1(factor),
      reference_grams: yieldG > 0 ? yieldG : null,
    },
    addons: addons.map((addon) => ({
      id: addon.id,
      label: addon.label || "",
      kcal: scaleKnown(addon.kcal, factor),
      protein: scaleKnown(addon.protein, factor),
      carbs: scaleKnown(addon.carbs, factor),
      fat: scaleKnown(addon.fat, factor),
      ...(addon.micros && typeof addon.micros === "object" ? { micros: scaleKnownMicros(addon.micros, factor) } : {}),
    })),
  };
}

export function componentSnapshot(meal) {
  if (meal?.components_snapshot === true) return Array.isArray(meal.components) ? meal.components : [];
  if (Array.isArray(meal?.components) && meal.components.length > 0) return meal.components;
  return null;
}

export function microSnapshot(meal) {
  if (meal?.micros_snapshot === true) return meal.micros && typeof meal.micros === "object" ? meal.micros : {};
  if (meal?.micros && typeof meal.micros === "object") return meal.micros;
  return null;
}
