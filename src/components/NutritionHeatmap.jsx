import { useWeekLogs, weekDates, localISO } from "../hooks/weekLogs.js";

const DAY_LABELS  = ["Mo","Di","Mi","Do","Fr","Sa","So"];
const HEAT_COLORS = ["transparent","#f87171","#fb923c","#a3e635","#4ade80"];
const HEAT_WIDTHS = [0, 25, 50, 75, 100];

function kcalLevel(kcal) {
  if (!kcal)       return 0;
  if (kcal < 800)  return 1;
  if (kcal < 1500) return 2;
  if (kcal < 2000) return 3;
  return 4;
}

export default function NutritionHeatmap({ selectedDate, onSelectDate }) {
  const today  = localISO(new Date());
  const dates  = weekDates(selectedDate);
  const { data: logsMap = {} } = useWeekLogs(selectedDate);

  return (
    <div className="mb-4 grid grid-cols-7 gap-1 rounded-xl border border-white/10 bg-slate-900/60 p-3">
      {dates.map((dk, i) => {
        const meals    = logsMap[dk] || [];
        const kcal     = meals.reduce((s, m) => s + (Number(m.kcal) || 0), 0);
        const level    = kcalLevel(kcal);
        const isToday    = dk === today;
        const isSelected = dk === selectedDate;
        return (
          <button
            key={dk}
            onClick={() => onSelectDate(dk)}
            className="flex flex-col items-center gap-1 rounded-lg p-1 transition hover:bg-white/5"
            style={{ borderBottom: isSelected ? "2px solid #f97316" : "2px solid transparent" }}
          >
            <span className="text-[9px] font-bold tracking-widest"
              style={{ color: isSelected ? "#f97316" : isToday ? "#4ade80" : "#4a5874" }}>
              {DAY_LABELS[i]}
            </span>
            <span className="text-[10px] font-semibold"
              style={{ color: isSelected ? "#f97316" : isToday ? "#4ade80" : "#7b8ba5" }}>
              {dk.slice(8)}
            </span>
            <div className="h-[5px] w-full overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${HEAT_WIDTHS[level]}%`, background: HEAT_COLORS[level] }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
