import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { History } from "lucide-react";
import { fetchJson, postJson } from "@api";
import HistoryDayCard from "./HistoryDayCard.jsx";

export default function HistoryView({ setActiveDate, setActiveTab }) {
  const qc = useQueryClient();
  const [expandedDays, setExpandedDays] = useState(new Set());

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

      <div className="grid gap-4">
        {history.map((day) => (
          <HistoryDayCard
            key={day.date}
            day={day}
            isExpanded={expandedDays.has(day.date)}
            onToggle={toggleDay}
            setActiveDate={setActiveDate}
            setActiveTab={setActiveTab}
            deleteMeal={deleteMeal}
          />
        ))}
      </div>

      {history.length === 0 && (
        <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/5 p-12 text-center">
          <p className="text-slate-500 font-medium">Noch keine Einträge vorhanden.</p>
        </div>
      )}
    </div>
  );
}
