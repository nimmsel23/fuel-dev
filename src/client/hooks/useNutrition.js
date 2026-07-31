import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@api";
import * as firestore from "../lib/db.firestore.js";

const isCloud = () => window.location.hostname.includes("web.app") || window.location.hostname.includes("firebaseapp.com");

export function useNutritionData(date) {
  return useQuery({
    queryKey: ["nutrition", date],
    queryFn: async () => {
      if (isCloud()) {
        return await firestore.getNutritionLog(date);
      }
      try {
        const data = await fetchJson(`/nutrition/log?date=${date}`);
        return data.data;
      } catch (err) {
        console.warn("API fallback to Firestore:", err);
        return await firestore.getNutritionLog(date);
      }
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

      if (isCloud()) {
        const logs = await firestore.getNutritionLogsInRange(dates);
        return dates.map(d => {
          const meals = logs[d]?.meals || [];
          return {
            day: d.slice(5),
            kcal: Math.round(meals.reduce((s, m) => s + (m.kcal || 0), 0)),
            protein: Math.round(meals.reduce((s, m) => s + (m.protein || 0), 0)),
            carbs: Math.round(meals.reduce((s, m) => s + (m.carbs || 0), 0)),
            fat: Math.round(meals.reduce((s, m) => s + (m.fat || 0), 0)),
          };
        });
      }

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

// Meal-Logging-Streak: aufeinanderfolgende Tage mit ≥1 geloggter Mahlzeit,
// rückwärts ab anchorDate (ein noch leerer heutiger Tag bricht die Streak nicht).
export function useMealStreak(anchorDate, days = 30) {
  return useQuery({
    queryKey: ["meal-streak", anchorDate, days],
    queryFn: async () => {
      const anchor = new Date(anchorDate);
      const dates = Array.from({ length: days }, (_, i) => {
        const d = new Date(anchor);
        d.setDate(d.getDate() - (days - 1 - i));
        return d.toISOString().slice(0, 10);
      });

      let mealsByDate;
      if (isCloud()) {
        const logs = await firestore.getNutritionLogsInRange(dates);
        mealsByDate = dates.map((d) => (logs[d]?.meals || []).length > 0);
      } else {
        const results = await Promise.all(
          dates.map((d) =>
            fetchJson(`/nutrition/log?date=${d}`)
              .then((r) => (r.data?.meals || []).length > 0)
              .catch(() => false)
          )
        );
        mealsByDate = results;
      }

      let current = 0;
      for (let i = mealsByDate.length - 1; i >= 0; i--) {
        if (mealsByDate[i]) current++;
        else if (i === mealsByDate.length - 1) continue; // heute noch leer → nicht werten
        else break;
      }

      let best = 0;
      let run = 0;
      for (const logged of mealsByDate) {
        run = logged ? run + 1 : 0;
        if (run > best) best = run;
      }

      const loggedDays = mealsByDate.filter(Boolean).length;
      return { current, best, loggedDays, days };
    },
    staleTime: 5 * 60 * 1000,
  });
}

// "Erste Mahlzeit"-Trend: Uhrzeit der ersten geloggten Mahlzeit pro Tag
// (letzte `days` Tage). Unterstützt den Früher-essen-Loop / Fastenfenster.
export function useFirstMealTrend(anchorDate, days = 7) {
  return useQuery({
    queryKey: ["first-meal-trend", anchorDate, days],
    queryFn: async () => {
      const anchor = new Date(anchorDate);
      const dates = Array.from({ length: days }, (_, i) => {
        const d = new Date(anchor);
        d.setDate(d.getDate() - (days - 1 - i));
        return d.toISOString().slice(0, 10);
      });

      let logs;
      if (isCloud()) {
        const byDate = await firestore.getNutritionLogsInRange(dates);
        logs = dates.map((d) => ({ date: d, meals: byDate[d]?.meals || [] }));
      } else {
        logs = await Promise.all(
          dates.map((d) =>
            fetchJson(`/nutrition/log?date=${d}`)
              .then((r) => ({ date: d, meals: r.data?.meals || [] }))
              .catch(() => ({ date: d, meals: [] }))
          )
        );
      }

      const entries = logs.map(({ date, meals }) => {
        const times = meals
          .map((m) => m.logged_at || m.created_at)
          .filter(Boolean)
          .map((t) => new Date(t))
          .filter((d) => !isNaN(d));
        if (!times.length) return { date, minutes: null };
        const first = new Date(Math.min(...times));
        return { date, minutes: first.getHours() * 60 + first.getMinutes() };
      });

      const known = entries.filter((e) => e.minutes != null);
      const avg = known.length
        ? Math.round(known.reduce((s, e) => s + e.minutes, 0) / known.length)
        : null;

      return { entries, avg };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useNotes(date) {
  return useQuery({
    queryKey: ["notes", date],
    queryFn: async () => {
      if (isCloud()) {
        return await firestore.getNotes(date);
      }
      try {
        const data = await fetchJson(`/nutrition/notes?date=${date}`);
        return data.content;
      } catch (err) {
        console.warn("API fallback to Firestore:", err);
        return await firestore.getNotes(date);
      }
    },
    staleTime: 30_000,
  });
}

// Wartende AI-Logger-Rohtext-Einträge, deren Gemini-Analyse noch aussteht
// oder fehlgeschlagen ist. Nur Cloud-Channel (Vertex läuft im Browser).
export function usePendingAiEntries(date) {
  return useQuery({
    queryKey: ["ai-pending", date],
    queryFn: () => firestore.getPendingAiEntries(date),
    enabled: isCloud(),
    staleTime: 10_000,
  });
}
