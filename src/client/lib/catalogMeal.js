function round1(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

// Baut eine logbare Mahlzeit aus einem Katalogeintrag. Add-on-Makros sind
// absolut zur Katalogportion und skalieren mit der gewählten Grammzahl.
export function mealFromCatalogItem(item, { addonIds = [], grams = null } = {}) {
  const yieldG = Number(item?.yield_g) || 0;
  const requested = Number(grams) || 0;
  const factor = yieldG > 0 && requested > 0 ? requested / yieldG : 1;
  const selected = new Set(addonIds);
  const addons = (Array.isArray(item?.addons) ? item.addons : []).filter((addon) => addon && selected.has(addon.id));
  const extra = addons.reduce((sum, addon) => ({
    kcal: sum.kcal + (Number(addon.kcal) || 0),
    protein: sum.protein + (Number(addon.protein) || 0),
    carbs: sum.carbs + (Number(addon.carbs) || 0),
    fat: sum.fat + (Number(addon.fat) || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const labels = addons.map((addon) => String(addon.label || "").trim()).filter(Boolean);
  const notes = [item?.notes, labels.length ? `Add-ons: ${labels.join(", ")}` : ""].filter(Boolean).join("\n");
  return {
    type: item?.meal_type || item?.type || "meal",
    description: item?.name || item?.description || "",
    notes,
    grams: requested || yieldG || null,
    catalog_id: item?.id || null,
    catalog_item_id: item?.id || null,
    kcal: Math.round((Number(item?.kcal) || 0) * factor + extra.kcal * factor),
    protein: round1((Number(item?.protein) || 0) * factor + extra.protein * factor),
    carbs: round1((Number(item?.carbs) || 0) * factor + extra.carbs * factor),
    fat: round1((Number(item?.fat) || 0) * factor + extra.fat * factor),
  };
}
