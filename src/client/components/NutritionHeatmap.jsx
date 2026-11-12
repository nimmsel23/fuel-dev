import { AlertTriangle } from "lucide-react";
import { useWeekLogs } from "../hooks/weekLogs.js";
import { aggregateWeek, calendarDay, shiftCalendarDay, weekDates } from "../lib/calendarDay.js";
import { useViennaDate } from "../hooks/useViennaToday.js";
import { useSettings } from "../store.js";

const DAY_LABELS  = ["Mo","Di","Mi","Do","Fr","Sa","So"];
const HEAT_COLORS = ["transparent","#f87171","#fb923c","#a3e635","#4ade80"];
const HEAT_WIDTHS = [0, 25, 50, 75, 100];

function getKcalLevel(kcal, goal) {
  if (!kcal) return 0;
  const pct = kcal / (goal || 2000);
  if (pct < 0.40) return 1;
  if (pct < 0.75) return 2;
  if (pct < 1.00) return 3;
  return 4;
}

// Vermutlich lückenhaft geloggt: wenig Einträge UND niedrige kcal. Nur
// Meal-Anzahl allein reicht nicht (OMAD-Tage haben oft nur 1 Eintrag, aber
// hohe kcal — legitim, siehe eating_pattern in FuelProfile.jsx). Erst die
// Kombination aus wenig Einträgen UND niedriger Summe ist ein echtes Signal
// für "wahrscheinlich vergessen weiterzuloggen" (30-Tage-Auswertung
// 2026-07-30: Tage mit <3 Einträgen lagen im Schnitt bei 746 statt 2022 kcal).
function looksIncomplete(meals, kcal, goal, pattern) {
  if (!goal || pattern === "omad") return false;
  return meals.length > 0 && meals.length < 3 && kcal < goal * 0.5;
}

export default function NutritionHeatmap({ selectedDate, onSelectDate }) {
  const { kcal_goal, eating_pattern } = useSettings();
  const today = useViennaDate();
  const dates = weekDates(selectedDate);
  const { data: logsMap = {} } = useWeekLogs(selectedDate);
  const week = aggregateWeek(selectedDate, logsMap);

  const goToPrevWeek = () => {
    const next = shiftCalendarDay(selectedDate, -7);
    if (next) onSelectDate(next);
  };

  const goToNextWeek = () => {
    const next = shiftCalendarDay(selectedDate, 7);
    if (next) onSelectDate(next);
  };

  const goToToday = () => {
    onSelectDate(today || calendarDay());
  };

  return (
    <div className="mb-4 space-y-2">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={goToPrevWeek}
          className="min-h-11 rounded px-3 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
        >
          ← Vorher
        </button>
        <button
          type="button"
          onClick={goToToday}
          className="min-h-11 rounded px-3 text-xs font-medium text-slate-300 transition hover:bg-slate-700"
        >
          Heute
        </button>
        <button
          type="button"
          onClick={goToNextWeek}
          className="min-h-11 rounded px-3 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
        >
          Nachher →
        </button>
      </div>
      {dates.length === 7 && (
        <p className="sr-only">
          Woche {dates[0]} bis {dates[6]}, Summe {week.totals.kcal} kcal
          {week.totals.water_ml > 0 ? `, ${week.totals.water_ml} ml Wasser` : ""}
        </p>
      )}
      <div className="grid grid-cols-7 gap-1 rounded-xl border border-white/10 bg-slate-900/60 p-2" aria-label="Wochenansicht">
      {week.days.map((day, i) => {
        const meals = day.meals;
        const kcal = day.kcal;
        const level = getKcalLevel(kcal, kcal_goal);
        const incomplete = looksIncomplete(meals, kcal, kcal_goal, eating_pattern);
        const isToday = day.date === today;
        const isSelected = day.date === selectedDate;
        const summary = `${DAY_LABELS[i]} ${day.date.slice(8)}.${day.date.slice(5, 7)}., ${kcal} kcal${day.water_ml ? `, ${day.water_ml} ml Wasser` : ""}`;
        return (
          <button
            key={day.date}
            type="button"
            onClick={() => onSelectDate(day.date)}
            aria-label={summary}
            title={incomplete ? "Wenige Einträge, niedrige kcal — evtl. nicht alles geloggt?" : summary}
            className="relative flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-1.5 transition hover:bg-white/5"
            style={{ borderBottom: isSelected ? "2px solid #f97316" : day.waterOnly ? "2px solid #38bdf8" : "2px solid transparent" }}
          >
            {incomplete && (
              <AlertTriangle className="absolute -top-1 -right-1 h-3 w-3 text-amber-400" />
            )}
            <span className="text-[9px] font-bold tracking-widest"
              style={{ color: isSelected ? "#f97316" : isToday ? "#4ade80" : "#4a5874" }}>
              {DAY_LABELS[i]}
            </span>
            <span className="text-[10px] font-semibold"
              style={{ color: isSelected ? "#f97316" : isToday ? "#4ade80" : "#7b8ba5" }}>
              {day.date.slice(8)}
            </span>
            <div className="h-[5px] w-full overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${day.waterOnly ? 100 : HEAT_WIDTHS[level]}%`, background: day.waterOnly ? "#38bdf8" : HEAT_COLORS[level] }} />
            </div>
          </button>
        );
      })}
      </div>
    </div>
  );
}
