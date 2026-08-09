import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@api";
import { DACH } from "../../shared/config/dach.mjs";

function getWeekKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-${week}`;
}

export function useMicrosWeekly(weeks) {
  return useQuery({
    queryKey: ["micros-weekly"],
    queryFn: async () => {
      // Find overall start and end dates
      const startWeek = weeks[weeks.length - 1]; // oldest
      const endWeek = weeks[0]; // newest
      
      // Calculate actual dates
      const d = new Date(startWeek.year, 0, 4);
      d.setDate(d.getDate() - (d.getDay() || 7) + 1 + (startWeek.week - 1) * 7);
      const startDate = d.toISOString().split('T')[0];
      
      const dEnd = new Date(endWeek.year, 0, 4);
      dEnd.setDate(dEnd.getDate() - (dEnd.getDay() || 7) + 7 + (endWeek.week - 1) * 7);
      const endDate = dEnd.toISOString().split('T')[0];

      // Fetch the optimized journal range
      const res = await fetchJson(`/journal/range?start=${startDate}&end=${endDate}`).catch(() => ({ data: [] }));
      const journals = res.data || [];

      // Group by week -> day -> micro sum
      const weeklyData = {};

      // Initialize weeklyData
      for (const { year, week } of weeks) {
        weeklyData[`${year}-${week}`] = {
          days: {},
          totals: {},
        };
      }

      // Process journals using pre-calculated micros_sum (Firestore Optimization)
      for (const journal of journals) {
        const dateStr = journal.date;
        const weekKey = getWeekKey(dateStr);
        if (!weeklyData[weekKey]) continue;

        const wData = weeklyData[weekKey];
        wData.days[dateStr] = journal.micros_sum || {};
      }

      // Calculate averages and percent of DACH
      const finalData = {};
      for (const { year, week } of weeks) {
        const weekKey = `${year}-${week}`;
        const wData = weeklyData[weekKey];
        const rda_comparison = {};

        // Mahlzeiten ohne Eintrag zählen als 0 -> wir teilen einfach durch 7 (Ø täglich)
        for (const key of Object.keys(DACH)) {
          let sum = 0;
          for (const dateStr of Object.keys(wData.days)) {
             sum += (wData.days[dateStr][key] || 0);
          }
          const avg = sum / 7;
          
          if (avg > 0) {
            const dachValue = DACH[key].value;
            rda_comparison[key] = {
              avg_daily: Math.round(avg * 10) / 10,
              dach: dachValue,
              percent_of_dach: Math.round((avg / dachValue) * 100),
            };
          }
        }
        
        finalData[weekKey] = { rda_comparison };
      }

      return finalData;
    },
    staleTime: 5 * 60 * 1000,
  });
}
