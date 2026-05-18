// RDA (Recommended Dietary Allowance) values for adults
// Source: NIH, DRI (Dietary Reference Intakes)

export const RDA = {
  vitamin_b12_ug: { value: 2.4, unit: "µg" },
  calcium_mg: { value: 1000, unit: "mg" }, // 1000-1200 depending on age/gender
  iron_mg: { value: 8, unit: "mg" }, // 8 (men), 18 (women 19-50)
  vitamin_d_ug: { value: 15, unit: "µg" }, // 15-20
  vitamin_e_mg: { value: 15, unit: "mg" },
  folate_ug: { value: 400, unit: "µg" },
  magnesium_mg: { value: 400, unit: "mg" }, // 400-420 (men), 310-320 (women)
  zinc_mg: { value: 11, unit: "mg" }, // 11 (men), 8 (women)
  sodium_mg: { value: 1500, unit: "mg" }, // Adequate Intake
  potassium_mg: { value: 3400, unit: "mg" }, // Adequate Intake (men), 2600 (women)
};

export function getStatus(value, rda) {
  if (value >= rda * 0.9) return "ok"; // 90%+
  if (value >= rda * 0.5) return "warning"; // 50-90%
  return "critical"; // <50%
}
