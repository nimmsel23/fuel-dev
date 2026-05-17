import { useWeekLogs } from "../hooks/useWeekLogs.js";

const DAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
function kcalLevel(kcal) {
  if (!kcal || kcal === 0) return 0;
  if (kcal < 800)  return 1;
  if (kcal < 1500) return 2;
  if (kcal < 2000) return 3;
  return 4;
}

const LEVEL_COLORS = ["transparent", "#f87171", "#fb923c", "#a3e635", "#4ade80"];
const LEVEL_WIDTH  = [0, 25, 50, 75, 100];

export default function NutritionHeatmap({ selectedDate, onSelectDate }) {
  const today = new Date().toISOString().slice(0, 10);
  const { logs, dates } = useWeekLogs(selectedDate);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(7, 1fr)",
      gap: "4px",
      padding: "0.75rem 1rem",
      background: "var(--surface)",
      borderBottom: "1px solid var(--border)",
    }}>
      {dates.map((dk, i) => {
        const meals = logs[dk]?.meals || [];
        const kcal = meals.reduce((s, m) => s + (m.kcal || 0), 0);
        const level = kcalLevel(kcal);
        const isToday = dk === today;
        const isSelected = dk === selectedDate;

        return (
          <button
            key={dk}
            onClick={() => onSelectDate(dk)}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: isSelected ? "2px solid var(--accent)" : "2px solid transparent",
              padding: "0 0 4px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "3px",
            }}
          >
            <span style={{
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: ".08em",
              color: isSelected ? "var(--accent)" : isToday ? "#4ade80" : "#4a5060",
            }}>
              {DAY_LABELS[i]}
            </span>
            <span style={{
              fontSize: "10px",
              color: isSelected ? "var(--accent)" : isToday ? "#4ade80" : "var(--muted)",
              fontWeight: isSelected || isToday ? 700 : 400,
            }}>
              {dk.slice(8)}
            </span>
            <div style={{
              width: "100%",
              height: "5px",
              borderRadius: "999px",
              background: "#1a1a1a",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                borderRadius: "999px",
                width: `${LEVEL_WIDTH[level]}%`,
                background: LEVEL_COLORS[level],
                transition: "width 0.3s ease",
              }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
