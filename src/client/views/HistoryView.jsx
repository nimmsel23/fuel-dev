import React from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Calendar, Utensils, ChevronRight } from "lucide-react";
import { fetchJson } from "@api";
import { twMerge } from "tailwind-merge";
import { sumMetric, formatMetric } from "../../shared/utils/utils.js";

export default function HistoryView({ setActiveDate, setActiveTab }) {
  const { data, isLoading } = useQuery({
    queryKey: ["nutrition-history"],
    queryFn: () => fetchJson("/nutrition/history?limit=50"),
  });

  const history = data?.history || [];

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 px-1">
        <History className="h-6 w-6 text-orange-300" />
        <h2 className="text-2xl font-bold tracking-tight">Ernährungs-Historie</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {history.map((day) => {
          const totalKcal = sumMetric(day.meals || [], "kcal");
          
          return (
            <button
              key={day.date}
              onClick={() => {
                setActiveDate(day.date);
                setActiveTab("food");
              }}
              className="group flex flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-6 text-left transition hover:bg-white/10 hover:shadow-glow active:scale-[0.98]"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm font-medium">{day.date}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-600 transition group-hover:text-orange-300 group-hover:translate-x-1" />
              </div>

              <div className="flex-1 space-y-3">
                {(day.meals || []).slice(0, 3).map((meal, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="mt-1 rounded-full bg-orange-400/20 p-1.5 text-orange-300">
                      <Utensils className="h-3 w-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-200">{meal.description}</div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">
                        {formatMetric(meal.kcal)} kcal · P {formatMetric(meal.protein)}g
                      </div>
                    </div>
                  </div>
                ))}
                {(day.meals || []).length > 3 && (
                  <div className="pl-9 text-xs text-slate-500 font-medium">
                    + {(day.meals || []).length - 3} weitere
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="text-xs uppercase tracking-widest text-slate-500">Tagessumme</div>
                <div className="text-lg font-bold text-orange-300">
                  {formatMetric(totalKcal)} <span className="text-xs font-normal text-slate-500 ml-1">kcal</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {history.length === 0 && (
        <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/5 p-12 text-center">
          <p className="text-slate-500 font-medium">Noch keine Einträge vorhanden.</p>
        </div>
      )}
    </div>
  );
}
