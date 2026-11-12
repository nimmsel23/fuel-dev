import { missingMealMacros, sumKnownMealMacro } from "../lib/mealMacros.js";
import StatsGrid from "./Dashboard/StatsGrid.jsx";
import DailyGoals from "./Dashboard/DailyGoals.jsx";
import MacroTrendChart from "./Dashboard/MacroTrendChart.jsx";
import TodayMeals from "./Dashboard/TodayMeals.jsx";
import JournalWidget from "./Dashboard/JournalWidget.jsx";
import MealStreakWidget from "./Dashboard/MealStreakWidget.jsx";
import FirstMealTrend from "./Dashboard/FirstMealTrend.jsx";
import QuickAiLog from "../components/QuickAiLog.jsx";
import IncompleteDayHint from "./Dashboard/IncompleteDayHint.jsx";
import FastingWindowBadge from "../components/FastingWindowBadge.jsx";
import WaterTracker from "./Dashboard/WaterTracker.jsx";
import { AI_ENABLED } from "../lib/aiAvailability.js";
import { useViennaDate } from "../hooks/useViennaToday.js";

export default function DashboardView({ nutrition, sup, journal, macroTrend, setActiveTab, activeDate }) {
  const meals = nutrition?.meals || [];
  const streak = sup?.stats?.[0]?.current_streak || 0;
  const missing = missingMealMacros(meals);
  const totalKcal = sumKnownMealMacro(meals, "kcal");
  const totalProtein = sumKnownMealMacro(meals, "protein");
  const waterMl = nutrition?.water_ml || 0;
  const isToday = activeDate === useViennaDate();

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
      <div className="grid gap-6">
        {AI_ENABLED && <QuickAiLog date={activeDate} />}
        {missing.kcal === 0 && <IncompleteDayHint totalKcal={totalKcal} isToday={isToday} />}
        <FastingWindowBadge />
        <FirstMealTrend activeDate={activeDate} />
        <StatsGrid mealsCount={meals.length} totalProtein={totalProtein} waterMl={waterMl} />
        <WaterTracker date={activeDate} waterMl={waterMl} />
        <DailyGoals totalKcal={totalKcal} totalProtein={totalProtein} waterMl={waterMl} missing={missing} />
        <MacroTrendChart macroTrend={macroTrend} />
      </div>

      <aside className="grid gap-6">
        <MealStreakWidget activeDate={activeDate} />
        <TodayMeals meals={meals} setActiveTab={setActiveTab} />
        <JournalWidget journal={journal} streak={streak} />
      </aside>
    </div>
  );
}
