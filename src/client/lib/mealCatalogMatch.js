// Automatic logging must never substitute a partial or ambiguous dish name.
const normalize = (value) => String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("de");
const completeMacros = (item) => ["kcal", "protein", "carbs", "fat"].every((key) => {
  const value = item[key];
  return value != null && !(typeof value === "string" && !value.trim()) && Number.isFinite(Number(value)) && Number(value) >= 0;
});

export function findCatalogMatch(catalog, name) {
  const target = normalize(name);
  if (!target) return null;
  const matches = (catalog || []).filter((item) => normalize(item?.name || item?.description) === target);
  return matches.length === 1 && completeMacros(matches[0]) ? matches[0] : null;
}
