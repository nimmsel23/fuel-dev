// DACH Reference Values for adults
// Source: DGE (Deutsche Gesellschaft für Ernährung), ÖGE (Österreichische Gesellschaft für Ernährung)
// Standard für Deutschland, Österreich, Schweiz

export const DACH = {
  vitamin_b12_ug: { value: 4, unit: "µg" },
  calcium_mg: { value: 1000, unit: "mg" },
  iron_mg: { value: 10, unit: "mg" },
  vitamin_d_ug: { value: 20, unit: "µg" },
  vitamin_e_mg: { value: 14, unit: "mg" },
  folate_ug: { value: 400, unit: "µg" },
  magnesium_mg: { value: 375, unit: "mg" },
  zinc_mg: { value: 8, unit: "mg" },
  sodium_mg: { value: 550, unit: "mg" },
  potassium_mg: { value: 4000, unit: "mg" },
};

export function getStatus(value, reference) {
  if (value >= reference * 0.9) return "ok"; // 90%+
  if (value >= reference * 0.5) return "warning"; // 50-90%
  return "critical"; // <50%
}
