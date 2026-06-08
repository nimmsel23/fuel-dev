import { Suspense } from "react";
import { TAB_CONFIG } from "../tabs.jsx";

function getTabProps(key, ctx) {
  switch (key) {
    case "dashboard":   return { nutrition: ctx.nutrition, sup: ctx.sup, journal: ctx.journal, macroTrend: ctx.macroTrend };
    case "food":        return { activeDate: ctx.activeDate, setActiveDate: ctx.setActiveDate, nutrition: ctx.nutrition };
    case "calendar":    return { date: ctx.activeDate, nutrition: ctx.nutrition };
    case "journal":     return { date: ctx.activeDate, nutrition: ctx.nutrition, journal: ctx.journal || "" };
    case "supplements": return { date: ctx.activeDate, sup: ctx.sup, catalog: ctx.suppCatalog || [], suppLog: ctx.suppLog };
    default:            return {};
  }
}

export default function TabContent({ activeTab, ctx }) {
  const tab = TAB_CONFIG.find((t) => t.key === activeTab);
  if (!tab) return null;
  const { View } = tab;
  return (
    <Suspense fallback={<div className="py-20 text-center text-slate-500 text-sm animate-pulse">Laden…</div>}>
      <View {...getTabProps(activeTab, ctx)} />
    </Suspense>
  );
}
