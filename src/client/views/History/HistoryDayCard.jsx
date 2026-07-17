import React from "react";
import { Calendar, ChevronRight, Trash2, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { sumMetric, formatMetric } from "../../shared/utils/utils.js";

export default function HistoryDayCard({ day, isExpanded, onToggle, setActiveDate, setActiveTab, deleteMeal }) {
  const totalKcal = sumMetric(day.meals || [], "kcal");
  
  return (
    <div
      className={twMerge(
        "group flex flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 transition-all duration-300",
        isExpanded ? "ring-1 ring-orange-400/20 bg-white/[0.08]" : "hover:bg-white/10"
      )}
    >
      <div className="flex items-center justify-between p-6">
        <button
          onClick={() => onToggle(day.date)}
          className="flex flex-1 items-center gap-4 text-left"
        >
          <div className="rounded-2xl bg-slate-950/50 p-3 text-orange-300 shadow-inner">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-100">{day.date}</div>
            <div className="text-xs uppercase tracking-widest text-slate-500">
              {day.meals?.length || 0} Mahlzeiten · {formatMetric(totalKcal)} kcal
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveDate(day.date);
              setActiveTab("food");
            }}
            title="Diesen Tag öffnen"
            className="rounded-xl border border-white/10 bg-white/5 p-3 text-slate-400 transition hover:bg-orange-400 hover:text-slate-950"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            onClick={() => onToggle(day.date)}
            className="rounded-xl border border-white/10 bg-white/5 p-3 text-slate-500 transition hover:text-white"
          >
            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-white/5 bg-slate-950/30 p-6 pt-2">
          <div className="space-y-2">
            {(day.meals || []).map((meal) => (
              <div key={meal.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-200">{meal.description}</div>
                  <div className="text-xs text-slate-500">
                    {formatMetric(meal.kcal)} kcal · P {formatMetric(meal.protein)}g · C {formatMetric(meal.carbs)}g · F {formatMetric(meal.fat)}g
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setActiveDate(day.date);
                      setActiveTab("food");
                    }}
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-white/10 hover:text-orange-300"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Möchtest du "${meal.description}" wirklich löschen?`)) {
                        deleteMeal.mutate({ date: day.date, mealId: meal.id });
                      }
                    }}
                    disabled={deleteMeal.isPending}
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
