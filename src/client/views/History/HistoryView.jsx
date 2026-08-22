import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { History, Calendar, ChevronRight, ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { fetchJson, postJson } from "@api";
import { sumMetric, formatMetric } from "../../../shared/utils/utils.js";

const DAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MON_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function localToday() {
  return new Date().toISOString().slice(0, 10);
}

function buildWeekGroups(today, history) {
  const daysByDate = Object.fromEntries((history || []).map((day) => [day.date, day]));
  const dates = Object.keys(daysByDate).filter((date) => date <= today).sort().reverse();
  if (dates.length === 0) return [];

  const todayObj = new Date(`${today}T12:00:00`);
  const dow0 = todayObj.getDay();
  const thisMonday = new Date(todayObj);
  thisMonday.setDate(todayObj.getDate() - (dow0 === 0 ? 6 : dow0 - 1));
  thisMonday.setHours(0, 0, 0, 0);

  const oldest = dates[dates.length - 1];
  const days = Math.max(0, Math.round((todayObj - new Date(`${oldest}T12:00:00`)) / 86400000));
  const weekCount = Math.max(8, Math.ceil(days / 7) + 1);

  return Array.from({ length: weekCount }, (_, w) => {
    const monday = new Date(thisMonday);
    monday.setDate(thisMonday.getDate() - w * 7);

    const allDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d.toISOString().slice(0, 10);
    }).filter((d) => d <= today).reverse();

    const visibleDays = allDays.filter((d) => daysByDate[d]);
    if (visibleDays.length === 0) return null;

    const jan4 = new Date(monday.getFullYear(), 0, 4);
    const kw = Math.max(1, Math.floor(((monday - jan4) / 86400000 + jan4.getDay() + 1) / 7));
    const label = w === 0 ? "Diese Woche" : w === 1 ? "Letzte Woche" : `KW ${kw} · ${monday.getFullYear()}`;

    return {
      label,
      visibleDays,
      entries: visibleDays.map((date) => daysByDate[date]).filter(Boolean),
    };
  }).filter(Boolean);
}

export default function HistoryView({ setActiveDate, setActiveTab }) {
  const qc = useQueryClient();
  const [expandedDays, setExpandedDays] = useState(new Set());
  const [collapsedWeeks, setCollapsedWeeks] = useState(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["nutrition-history"],
    queryFn: () => fetchJson("/nutrition/history?limit=100"),
  });

  const deleteMeal = useMutation({
    mutationFn: ({ date, mealId }) => postJson("/nutrition/log", { date, delete_meal_id: mealId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition-history"] });
      qc.invalidateQueries({ queryKey: ["week-logs"] });
    },
  });

  const toggleDay = (date) => {
    const next = new Set(expandedDays);
    if (next.has(date)) next.delete(date);
    else next.add(date);
    setExpandedDays(next);
  };

  const history = data?.history || [];
  const today = localToday();
  const weekGroups = buildWeekGroups(today, history);

  const toggleWeek = (label) => {
    const next = new Set(collapsedWeeks);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    setCollapsedWeeks(next);
  };

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

      {history.length === 0 && (
        <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/5 p-12 text-center">
          <p className="text-slate-500 font-medium">Noch keine Einträge vorhanden.</p>
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-2">
          {weekGroups.map((week) => {
            const isCollapsed = collapsedWeeks.has(week.label);
            return (
              <div key={week.label}>
                <button
                  onClick={() => toggleWeek(week.label)}
                  className="flex w-full items-center gap-3 px-2 pb-2 pt-4 text-left"
                >
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500/70">
                    {week.label}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                    {week.entries.length}x
                  </span>
                  <div className="flex-1" />
                  <ChevronRight
                    className="h-3.5 w-3.5 text-slate-500 transition-transform"
                    style={{ transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)" }}
                  />
                </button>

                {!isCollapsed && (
                  <div className="relative">
                    <div className="absolute bottom-0 left-[67px] top-0 w-px bg-white/10" />
                    {week.entries.map((day) => {
                      const isExpanded = expandedDays.has(day.date);
                      const totalKcal = sumMetric(day.meals || [], "kcal");
                      const totalProtein = sumMetric(day.meals || [], "protein");
                      const totalCarbs = sumMetric(day.meals || [], "carbs");
                      const totalFat = sumMetric(day.meals || [], "fat");
                      const dateObj = new Date(`${day.date}T12:00:00`);
                      const dayName = DAY_SHORT[dateObj.getDay()];
                      const dayNum = dateObj.getDate();
                      const mon = MON_SHORT[dateObj.getMonth()];
                      const isToday = day.date === today;

                      return (
                        <div key={day.date} className="flex items-start">
                          <div className="w-14 shrink-0 pr-3 pt-3 text-right">
                            <div className="text-[8px] font-black uppercase text-slate-500/60">
                              {dayName}
                            </div>
                            <div className={`text-[14px] font-black leading-tight ${isToday ? "text-orange-300" : "text-slate-300/80"}`}>
                              {dayNum}
                            </div>
                            <div className="text-[7px] font-bold uppercase text-slate-500/40">
                              {mon}
                            </div>
                          </div>

                          <div className="mt-[18px] flex w-5 shrink-0 flex-col items-center">
                            <div className={`relative z-10 h-3 w-3 rounded-full border-2 ${isToday ? "border-orange-300 bg-orange-300/25" : "border-orange-400/70 bg-orange-400/15"}`} />
                          </div>

                          <div className="min-w-0 flex-1 pb-4 pl-2">
                            <div
                              className={`overflow-hidden rounded-[1.6rem] border transition-all duration-200 ${
                                isExpanded
                                  ? "border-orange-400/20 bg-white/[0.08] ring-1 ring-orange-400/15"
                                  : "border-white/10 bg-white/5 hover:bg-white/[0.08]"
                              }`}
                            >
                              <div className="flex items-center gap-3 px-4 py-4">
                                <button
                                  onClick={() => toggleDay(day.date)}
                                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                >
                                  <div className="rounded-2xl bg-slate-950/60 p-2.5 text-orange-300">
                                    <Calendar className="h-4.5 w-4.5" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-black text-slate-100">
                                      {day.date}
                                    </div>
                                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                                      {day.meals?.length || 0} Mahlzeiten
                                    </div>
                                  </div>
                                </button>

                                <div className="hidden text-right sm:block">
                                  <div className="text-sm font-black text-orange-200">{formatMetric(totalKcal)} kcal</div>
                                  <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500">
                                    P {formatMetric(totalProtein)} · C {formatMetric(totalCarbs)} · F {formatMetric(totalFat)}
                                  </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                  <button
                                    onClick={() => {
                                      setActiveDate(day.date);
                                      setActiveTab("food");
                                    }}
                                    title="Diesen Tag öffnen"
                                    className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-400 transition hover:bg-orange-400 hover:text-slate-950"
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => toggleDay(day.date)}
                                    className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-500 transition hover:text-white"
                                  >
                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </button>
                                </div>
                              </div>

                              <div className="border-t border-white/5 px-4 pb-4 text-[10px] uppercase tracking-[0.15em] text-slate-500 sm:hidden">
                                <div className="pt-3">{formatMetric(totalKcal)} kcal</div>
                                <div className="pt-1">P {formatMetric(totalProtein)} · C {formatMetric(totalCarbs)} · F {formatMetric(totalFat)}</div>
                              </div>

                              {isExpanded && (
                                <div className="border-t border-white/5 bg-slate-950/30 p-4">
                                  <div className="space-y-2">
                                    {(day.meals || []).map((meal) => (
                                      <div
                                        key={meal.id}
                                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3"
                                      >
                                        <div className="min-w-0 flex-1">
                                          <div className="truncate font-medium text-slate-200">{meal.description}</div>
                                          <div className="text-xs text-slate-500">
                                            {formatMetric(meal.kcal)} kcal · P {formatMetric(meal.protein)}g · C {formatMetric(meal.carbs)}g · F {formatMetric(meal.fat)}g
                                          </div>
                                        </div>
                                        <div className="flex shrink-0 gap-2">
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
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
