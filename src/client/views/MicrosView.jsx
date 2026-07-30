import React, { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Wand2, Sparkles } from "lucide-react";
import { fetchJson } from "@api";
import { lastNWeeks } from "./Micros/utils.js";
import { readCache, writeCache } from "../lib/localCache.js";
import MicrosLegend from "./Micros/MicrosLegend.jsx";
import MicrosGrid from "./Micros/MicrosGrid.jsx";
import MicrosEstimator from "./Micros/MicrosEstimator.jsx";
import MicrosDetailModal from "./Micros/MicrosDetailModal.jsx";
import MicrosAiCoach from "./Micros/MicrosAiCoach.jsx";
import MicrosSuperfoodRadar from "./Micros/MicrosSuperfoodRadar.jsx";

// Cache hält den letzten bekannten Stand pro Woche vor — Heatmap zeigt beim
// Öffnen sofort etwas an, statt auf 8 parallele Requests zu warten (optimistic).
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const cacheKey = (year, week) => `nutrition-weekly:${year}:${week}`;

export default function MicrosView() {
  const [estimatorOpen, setEstimatorOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [detail, setDetail] = useState(null); // { nutrient, week, weekData }
  const weeks = lastNWeeks(8);

  const results = useQueries({
    queries: weeks.map(({ year, week }) => ({
      queryKey: ["nutrition-weekly", year, week],
      queryFn: () =>
        fetchJson(`/nutrition/weekly/${year}/${week}`).then((d) => {
          if (d.ok) writeCache(cacheKey(year, week), d);
          return d.ok ? d : null;
        }),
      placeholderData: () => readCache(cacheKey(year, week), CACHE_MAX_AGE_MS),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const missingMeals = Array.from(
    new Set(
      results
        .flatMap((r) => r.data?.missing_meals || [])
        .filter(Boolean)
    )
  );

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Mikronährstoffe</h2>
          <p className="text-sm text-slate-400">Ø täglich vs. DACH-Referenzwerte · letzte 8 Wochen</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCoachOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:brightness-110 active:scale-95"
          >
            <Sparkles className="h-4 w-4 animate-pulse text-amber-300" />
            AI Coach
          </button>

          {missingMeals.length > 0 && (
            <button
              onClick={() => setEstimatorOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-600/20 px-3.5 py-2 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-600/30"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Lücken schätzen ({missingMeals.length})
            </button>
          )}
        </div>
      </div>
      
      <MicrosLegend />
      <MicrosGrid
        weeks={weeks}
        results={results}
        onCellClick={(nutrient, week, weekData) => setDetail({ nutrient, week, weekData })}
      />

      <p className="text-xs text-slate-600">
        Mikronährstoffe werden aus dem Micros-Katalog geschätzt. Mahlzeiten ohne Eintrag zählen als 0.
        Zelle anklicken für Tagesverlauf.
      </p>

      {/* Superfood & Nährstoff-Defizit Empfehlungen */}
      <MicrosSuperfoodRadar results={results} />

      {coachOpen && (
        <MicrosAiCoach
          weeks={weeks}
          results={results}
          onClose={() => setCoachOpen(false)}
        />
      )}

      {estimatorOpen && (
        <MicrosEstimator
          missingMeals={missingMeals}
          onClose={() => setEstimatorOpen(false)}
        />
      )}

      {detail && (
        <MicrosDetailModal
          nutrient={detail.nutrient}
          week={detail.week}
          weekData={detail.weekData}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}


