import { Sunrise } from "lucide-react";
import { useFirstMealTrend } from "../../hooks/useNutrition.js";

const fmtTime = (minutes) => {
  if (minutes == null) return "—";
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
};

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export default function FirstMealTrend({ activeDate }) {
  const { data, isLoading } = useFirstMealTrend(activeDate);
  const entries = data?.entries || [];
  const avg = data?.avg ?? null;

  // Skala: 06:00–18:00 auf Balkenhöhe abbilden, früher = kürzerer Balken
  const minScale = 6 * 60;
  const maxScale = 18 * 60;
  const barPct = (minutes) => {
    if (minutes == null) return 0;
    const clamped = Math.min(Math.max(minutes, minScale), maxScale);
    return Math.round(((clamped - minScale) / (maxScale - minScale)) * 100);
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sunrise className="h-5 w-5 text-amber-300" />
          <h2 className="text-lg font-semibold">Erste Mahlzeit</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-400">
          Ø {fmtTime(avg)}
        </span>
      </div>
      {isLoading ? (
        <p className="text-sm text-slate-400">Lade Trend…</p>
      ) : (
        <div className="flex items-end justify-between gap-2">
          {entries.map(({ date, minutes }) => (
            <div key={date} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-slate-400">{fmtTime(minutes)}</span>
              <div className="flex h-16 w-full items-end rounded bg-slate-950/40">
                <div
                  className={`w-full rounded ${minutes != null ? "bg-amber-400/70" : "bg-slate-700/40"}`}
                  style={{ height: `${minutes != null ? Math.max(barPct(minutes), 8) : 4}%` }}
                  title={`${date}: ${fmtTime(minutes)}`}
                />
              </div>
              <span className="text-[10px] uppercase text-slate-500">
                {WEEKDAYS[new Date(date).getDay()]}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Früher essen → früher schlafen → früher trainieren. Kürzerer Balken = früherer Start.
      </p>
    </section>
  );
}
