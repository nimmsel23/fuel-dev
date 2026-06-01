import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "../lib/api.js";

export function useNutritionData(date) {
  return useQuery({
    queryKey: ["nutrition", date],
    queryFn: async () => {
      const data = await fetchJson(`/nutrition/log?date=${date}`);
      return data.data;
    },
    staleTime: 30_000,
  });
}

export function useMacroTrend(anchorDate, days = 10) {
  return useQuery({
    queryKey: ["macro-trend", anchorDate, days],
    queryFn: async () => {
      const anchor = new Date(anchorDate);
      const dates = Array.from({ length: days }, (_, i) => {
        const d = new Date(anchor);
        d.setDate(d.getDate() - (days - 1 - i));
        return d.toISOString().slice(0, 10);
      });
      const results = await Promise.all(
        dates.map((d) =>
          fetchJson(`/nutrition/log?date=${d}`)
            .then((r) => ({ date: d, meals: r.data?.meals || [] }))
            .catch(() => ({ date: d, meals: [] }))
        )
      );
      return results.map(({ date, meals }) => ({
        day: date.slice(5),
        kcal: Math.round(meals.reduce((s, m) => s + (m.kcal || 0), 0)),
        protein: Math.round(meals.reduce((s, m) => s + (m.protein || 0), 0)),
        carbs: Math.round(meals.reduce((s, m) => s + (m.carbs || 0), 0)),
        fat: Math.round(meals.reduce((s, m) => s + (m.fat || 0), 0)),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useJournal(date) {
  return useQuery({
    queryKey: ["journal", date],
    queryFn: async () => {
      const data = await fetchJson(`/nutrition/journal?date=${date}`);
      return data.content;
    },
    staleTime: 30_000,
  });
}
