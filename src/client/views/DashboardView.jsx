import { sumMetric } from "../../shared/utils/utils.js";
import StatsGrid from "./Dashboard/StatsGrid.jsx";
import DailyGoals from "./Dashboard/DailyGoals.jsx";
import MacroTrendChart from "./Dashboard/MacroTrendChart.jsx";
import TodayMeals from "./Dashboard/TodayMeals.jsx";
import JournalWidget from "./Dashboard/JournalWidget.jsx";
import QuickAiLog from "../components/QuickAiLog.jsx";
import IncompleteDayHint from "./Dashboard/IncompleteDayHint.jsx";
import FastingWindowBadge from "../components/FastingWindowBadge.jsx";
import { format } from "date-fns";

export default function DashboardView({ nutrition, sup, journal, macroTrend, setActiveTab, activeDate }) {
  const meals = nutrition?.meals || [];
  const streak = sup?.stats?.[0]?.current_streak || 0;
  const totalKcal = sumMetric(meals, "kcal");
  const totalProtein = sumMetric(meals, "protein");
  const waterMl = nutrition?.water_ml || 0;
  const isToday = activeDate === format(new Date(), "yyyy-MM-dd");

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
      <div className="grid gap-6">
        <QuickAiLog date={activeDate} />
        <IncompleteDayHint totalKcal={totalKcal} isToday={isToday} />
        <FastingWindowBadge />
        <StatsGrid mealsCount={meals.length} totalProtein={totalProtein} waterMl={waterMl} />
        <DailyGoals totalKcal={totalKcal} totalProtein={totalProtein} waterMl={waterMl} />
        <MacroTrendChart macroTrend={macroTrend} />
      </div>

      <aside className="grid gap-6">
        <TodayMeals meals={meals} setActiveTab={setActiveTab} />
        <JournalWidget journal={journal} streak={streak} />
      </aside>
    </div>
  );
}

