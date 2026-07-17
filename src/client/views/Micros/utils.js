export const NUTRIENTS = [
  // Fettlöslich
  { key: "vitamin_a_ug",   label: "Vit. A",    unit: "µg" },
  { key: "vitamin_d_ug",   label: "Vit. D",    unit: "µg" },
  { key: "vitamin_e_mg",   label: "Vit. E",    unit: "mg" },
  { key: "vitamin_k_ug",   label: "Vit. K",    unit: "µg" },
  // Wasserlöslich
  { key: "vitamin_c_mg",   label: "Vit. C",    unit: "mg" },
  { key: "vitamin_b1_mg",  label: "B1",        unit: "mg" },
  { key: "vitamin_b2_mg",  label: "B2",        unit: "mg" },
  { key: "vitamin_b3_mg",  label: "B3",        unit: "mg" },
  { key: "vitamin_b5_mg",  label: "B5",        unit: "mg" },
  { key: "vitamin_b6_mg",  label: "B6",        unit: "mg" },
  { key: "vitamin_b7_ug",  label: "B7",        unit: "µg" },
  { key: "folate_ug",      label: "Folat",     unit: "µg" },
  { key: "vitamin_b12_ug", label: "B12",       unit: "µg" },
  // Mineralstoffe
  { key: "calcium_mg",     label: "Calcium",   unit: "mg" },
  { key: "phosphorus_mg",  label: "Phosphor",  unit: "mg" },
  { key: "magnesium_mg",   label: "Mg",        unit: "mg" },
  { key: "iron_mg",        label: "Eisen",     unit: "mg" },
  { key: "zinc_mg",        label: "Zink",      unit: "mg" },
  { key: "selenium_ug",    label: "Selen",     unit: "µg" },
  { key: "iodine_ug",      label: "Jod",       unit: "µg" },
  { key: "potassium_mg",   label: "Kalium",    unit: "mg" },
  { key: "sodium_mg",      label: "Natrium",   unit: "mg" },
  // Fettsäuren
  { key: "omega3_mg",      label: "Omega-3",   unit: "mg" },
];

export function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return {
    year: d.getFullYear(),
    week: 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7),
  };
}

export function lastNWeeks(n) {
  const weeks = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weeks.push(getISOWeek(d));
  }
  return weeks;
}

export function pctColor(pct) {
  if (pct == null) return { bg: "rgba(30,41,59,0.4)", text: "#475569" };
  if (pct >= 90)   return { bg: "#16a34a",            text: "#fff" };
  if (pct >= 50)   return { bg: "#d97706",            text: "#fff" };
  return               { bg: "#dc2626",            text: "#fff" };
}
