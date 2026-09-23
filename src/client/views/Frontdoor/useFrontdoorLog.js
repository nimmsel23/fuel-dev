import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson } from "@api";
import { useNutritionData } from "../../hooks/useNutrition.js";
import { useSettings } from "../../store.js";

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Tageszeit-Fenster, nach dem die Frontdoors Vorschläge gruppieren.
export function slotOf(hour = new Date().getHours()) {
  if (hour < 10) return "morgen";
  if (hour < 15) return "mittag";
  if (hour < 19) return "nachmittag";
  return "abend";
}

export const SLOT_LABEL = {
  morgen: "Morgen",
  mittag: "Mittag",
  nachmittag: "Nachmittag",
  abend: "Abend",
};

function hourOfMeal(meal) {
  const raw = meal?.logged_at || meal?.time || meal?.created_at;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.getHours();
}

function normKey(name) {
  return String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// Gemeinsame Datenbasis aller drei Frontdoors: heutiges Log, Katalog,
// Verlauf, Loggen + Rückgängig. Die Frontdoors unterscheiden sich in der
// Bedienung, nicht in den Daten.
export function useFrontdoorLog() {
  const date = today();
  const qc = useQueryClient();
  const [lastLogged, setLastLogged] = useState(null);
  const kcalGoal = useSettings((s) => s.kcal_goal) || 2000;
  const proteinGoal = useSettings((s) => s.protein_goal) || 150;

  const { data: nutrition } = useNutritionData(date);
  const meals = useMemo(() => nutrition?.meals || [], [nutrition]);

  const { data: catalogData } = useQuery({
    queryKey: ["nutrition-catalog"],
    queryFn: () => fetchJson("/nutrition/catalog"),
    staleTime: 0,
  });
  const catalogItems = useMemo(() => catalogData?.items || [], [catalogData]);

  const { data: historyData } = useQuery({
    queryKey: ["nutrition-history", 30],
    queryFn: () => fetchJson("/nutrition/history?limit=30").catch(() => ({ history: [] })),
    staleTime: 120_000,
  });
  const history = useMemo(() => historyData?.history || [], [historyData]);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["nutrition", date] });
    qc.invalidateQueries({ queryKey: ["nutrition-history"] });
    qc.invalidateQueries({ queryKey: ["week-logs"] });
    qc.invalidateQueries({ queryKey: ["macro-trend"] });
    qc.invalidateQueries({ queryKey: ["nutrition-catalog"] });
  }, [qc, date]);

  const logMeal = useMutation({
    mutationFn: async (meal) => {
      const id = meal.id || `meal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const payload = {
        id,
        type: meal.type || "meal",
        description: meal.description,
        notes: meal.notes || "",
        kcal: Math.round((Number(meal.kcal) || 0) * 10) / 10,
        protein: Math.round((Number(meal.protein) || 0) * 10) / 10,
        carbs: Math.round((Number(meal.carbs) || 0) * 10) / 10,
        fat: Math.round((Number(meal.fat) || 0) * 10) / 10,
        logged_at: new Date().toISOString(),
        ...(meal.catalog_id ? { catalog_id: meal.catalog_id } : {}),
      };
      await postJson("/nutrition/log", { date, meal: payload });
      return payload;
    },
    onSuccess: (payload) => {
      setLastLogged(payload);
      invalidate();
    },
  });

  const undoLast = useMutation({
    mutationFn: async () => {
      if (!lastLogged?.id) return;
      await postJson("/nutrition/log", { date, delete_meal_id: lastLogged.id });
    },
    onSuccess: () => {
      setLastLogged(null);
      invalidate();
    },
  });

  // Kachel-/Chip-Ranking: Tageszeit-Fenster zuerst, dann Häufigkeit der
  // letzten 30 Tage, dann Aktualität. Ohne Historie greift der Katalog als
  // Fallback, damit die Frontdoor nie leer startet.
  const suggestions = useMemo(() => {
    const slot = slotOf();
    const stats = new Map();

    history.forEach((log, logIdx) => {
      (log.meals || []).forEach((m) => {
        const key = normKey(m.description);
        if (!key) return;
        const h = hourOfMeal(m);
        const entry = stats.get(key) || {
          key,
          description: m.description,
          kcal: m.kcal || 0,
          protein: m.protein || 0,
          carbs: m.carbs || 0,
          fat: m.fat || 0,
          catalog_id: m.catalog_id || null,
          count: 0,
          slotCount: 0,
          recency: logIdx,
          lastDate: log.date,
        };
        entry.count += 1;
        if (h != null && slotOf(h) === slot) entry.slotCount += 1;
        if (logIdx < entry.recency) {
          entry.recency = logIdx;
          entry.lastDate = log.date;
        }
        stats.set(key, entry);
      });
    });

    const fromHistory = [...stats.values()].sort((a, b) => {
      if (b.slotCount !== a.slotCount) return b.slotCount - a.slotCount;
      if (b.count !== a.count) return b.count - a.count;
      return a.recency - b.recency;
    });

    const seen = new Set(fromHistory.map((e) => e.key));
    const fromCatalog = catalogItems
      .filter((i) => i.name && !seen.has(normKey(i.name)))
      .map((i) => ({
        key: normKey(i.name),
        description: i.name,
        kcal: i.kcal || 0,
        protein: i.protein || 0,
        carbs: i.carbs || 0,
        fat: i.fat || 0,
        catalog_id: i.id || null,
        count: 0,
        slotCount: 0,
        recency: 99,
        lastDate: null,
      }));

    return [...fromHistory, ...fromCatalog];
  }, [history, catalogItems]);

  const totals = useMemo(() => ({
    kcal: meals.reduce((s, m) => s + (Number(m.kcal) || 0), 0),
    protein: meals.reduce((s, m) => s + (Number(m.protein) || 0), 0),
    carbs: meals.reduce((s, m) => s + (Number(m.carbs) || 0), 0),
    fat: meals.reduce((s, m) => s + (Number(m.fat) || 0), 0),
  }), [meals]);

  return {
    date,
    meals,
    totals,
    kcalGoal,
    proteinGoal,
    catalogItems,
    suggestions,
    logMeal,
    undoLast,
    lastLogged,
    clearLastLogged: () => setLastLogged(null),
    invalidate,
  };
}
