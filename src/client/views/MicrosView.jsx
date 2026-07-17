import React, { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Wand2 } from "lucide-react";
import { fetchJson } from "@api";
import { lastNWeeks } from "./Micros/utils.js";
import MicrosLegend from "./Micros/MicrosLegend.jsx";
import MicrosGrid from "./Micros/MicrosGrid.jsx";
import MicrosEstimator from "./Micros/MicrosEstimator.jsx";

export default function MicrosView() {
  const [estimatorOpen, setEstimatorOpen] = useState(false);
  const weeks = lastNWeeks(8);

  const results = useQueries({
    queries: weeks.map(({ year, week }) => ({
      queryKey: ["nutrition-weekly", year, week],
      queryFn: () =>
        fetchJson(`/nutrition/weekly/${year}/${week}`)
          .then((d) => (d.ok ? d : null)),
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
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Mikronährstoffe</h2>
          <p className="text-sm text-slate-400">Ø täglich vs. DACH-Referenzwerte · letzte 8 Wochen</p>
        </div>
        
        {missingMeals.length > 0 && (
          <button
            onClick={() => setEstimatorOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-violet-600/20 px-3 py-1.5 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-600/30"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Lücken schätzen ({missingMeals.length})
          </button>
        )}
      </div>
      
      <MicrosLegend />
      <MicrosGrid weeks={weeks} results={results} />
      
      <p className="text-xs text-slate-600">
        Mikronährstoffe werden aus dem Micros-Katalog geschätzt. Mahlzeiten ohne Eintrag zählen als 0.
      </p>

      {estimatorOpen && (
        <MicrosEstimator
          missingMeals={missingMeals}
          onClose={() => setEstimatorOpen(false)}
        />
      )}
    </div>
  );
}

