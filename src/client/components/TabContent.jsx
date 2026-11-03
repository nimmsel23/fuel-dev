import NutritionDataNotice from "./NutritionDataNotice.jsx";
import { TAB_CONFIG } from "../routes.js";
import { ChunkErrorBoundary } from "./ErrorBoundary.jsx";

export default function TabContent({ activeTab, ctx }) {
  const tab = TAB_CONFIG.find((t) => t.key === activeTab);
  if (!tab) return null;
  const { View, getProps } = tab;
  return (
    <ChunkErrorBoundary>
      {["dashboard", "log", "log-dashboard", "log-timeline", "food"].includes(activeTab) && <NutritionDataNotice nutrition={ctx.nutrition} error={ctx.nutritionError} onRetry={ctx.reloadNutrition} />}
      <View {...getProps(ctx)} />
    </ChunkErrorBoundary>
  );
}
