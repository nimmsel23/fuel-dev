import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@api";
import { weekDates } from "../lib/calendarDay.js";

export { weekDates };

async function fetchLog(date) {
  try {
    const data = await fetchJson(`/nutrition/log?date=${date}`);
    const log = data.data || {};
    const water = Number(log.water_ml);
    return {
      date,
      meals: log.meals || [],
      water_ml: Number.isFinite(water) && water > 0 ? Math.round(water) : 0,
    };
  } catch {
    return { date, meals: [], water_ml: 0 };
  }
}

export function useWeekLogs(anchor) {
  const dates = weekDates(anchor);
  return useQuery({
    queryKey: ["week-logs", dates[0] || anchor],
    queryFn: async () => {
      const results = await Promise.all(weekDates(anchor).map(fetchLog));
      return Object.fromEntries(results.map((entry) => [entry.date, entry]));
    },
    staleTime: 0,
  });
}
