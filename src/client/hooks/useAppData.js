import { useNutritionData, useMacroTrend, useNotes } from "./useNutrition.js";
import { useSuppStats, useSuppCatalog, useSuppLog } from "./useSupplements.js";

export function useAppData(activeDate) {
  const nutritionQuery = useNutritionData(activeDate);
  const { data: nutrition } = nutritionQuery;
  const { data: sup }        = useSuppStats(activeDate);
  const { data: suppCatalog } = useSuppCatalog();
  const { data: suppLog }    = useSuppLog(activeDate);
  const { data: journal }    = useNotes(activeDate);
  const { data: macroTrend } = useMacroTrend(activeDate);
  return { nutrition, sup, suppCatalog, suppLog, journal, macroTrend, nutritionError: nutritionQuery.error };
}
