import { useNutritionData, useMacroTrend, useMealCatalog } from "./useNutrition.js";
import { useSuppStats, useSuppCatalog, useSuppLog } from "./useSupplements.js";

export function useAppData(activeDate) {
  const { data: nutrition }  = useNutritionData(activeDate);
  const { data: sup }        = useSuppStats(activeDate);
  const { data: suppCatalog } = useSuppCatalog();
  const { data: suppLog }    = useSuppLog(activeDate);
  const { data: macroTrend } = useMacroTrend(activeDate);
  const { data: mealCatalog } = useMealCatalog();
  return { nutrition, sup, suppCatalog, suppLog, macroTrend, mealCatalog };
}
