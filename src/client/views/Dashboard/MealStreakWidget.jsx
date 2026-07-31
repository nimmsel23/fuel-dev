import { Flame } from "lucide-react";
import { useMealStreak } from "../../hooks/useNutrition.js";

export default function MealStreakWidget({ activeDate }) {
  const { data, isLoading } = useMealStreak(activeDate);

  const current = data?.current ?? 0;
  const best = data?.best ?? 0;
  const loggedDays = data?.loggedDays ?? 0;
  const days = data?.days ?? 30;
  const isRecord = current > 0 && current === best;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Flame className={`h-5 w-5 ${current > 0 ? "text-orange-400" : "text-slate-500"}`} />
          <h2 className="text-lg font-semibold">Logging-Streak</h2>
        </div>
        {isRecord && (
          <span className="rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-orange-300">
            Rekord
          </span>
        )}
      </div>
      {isLoading ? (
        <p className="text-sm text-slate-400">Lade Streak…</p>
      ) : (
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-4xl font-bold text-slate-100">
              {current}
              <span className="ml-1 text-base font-normal text-slate-400">Tage</span>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {current > 0
                ? "in Folge mit geloggter Mahlzeit"
                : "Streak gebrochen — heute wieder starten"}
            </p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <p>Rekord: <span className="text-slate-200">{best}d</span></p>
            <p>{loggedDays}/{days} Tage geloggt</p>
          </div>
        </div>
      )}
    </section>
  );
}
