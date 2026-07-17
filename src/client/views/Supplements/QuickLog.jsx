import { Flame } from "lucide-react";
import { formatMetric, normalizeSupplementUnit } from "../../../shared/utils/utils.js";
import { useSupplementMutations } from "./useSupplementMutations.js";

const QUICK_LOG_LIMIT = 8;

export default function QuickLog({ date, catalog, stats }) {
  const { createIntake } = useSupplementMutations(date);

  const daysTakenBySupplement = stats.reduce((map, row) => {
    map[row.supplement.id] = row.days_taken;
    return map;
  }, {});

  const quickCatalog = [...catalog]
    .sort((a, b) => (daysTakenBySupplement[b.id] || 0) - (daysTakenBySupplement[a.id] || 0))
    .slice(0, QUICK_LOG_LIMIT);

  function logItem(item) {
    createIntake.mutate({
      supplement_id: item.id,
      dose: item.default_dose ?? 0,
      unit: normalizeSupplementUnit(item.unit),
      time_of_day: item.default_time_of_day || "any",
    });
  }

  if (quickCatalog.length === 0) return null;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="mb-4">
        <div className="mb-2 flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-300" />
          <h3 className="text-lg font-semibold">Quick log</h3>
        </div>
        <p className="text-sm text-slate-400">Die meistgenutzten Supplements der letzten 30 Tage, ein Tap mit den Katalog-Defaults.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {quickCatalog.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => logItem(item)}
            disabled={createIntake.isPending}
            className="flex items-center justify-between gap-3 rounded-2xl border border-orange-400/20 bg-orange-400/5 p-4 text-left transition hover:bg-orange-400/10 disabled:opacity-50"
          >
            <div>
              <div className="font-semibold text-slate-100">{item.name}</div>
              <div className="mt-1 text-xs text-slate-400">
                {formatMetric(item.default_dose ?? 0)} {normalizeSupplementUnit(item.unit)}
              </div>
            </div>
            <div className="text-xl">⚡</div>
          </button>
        ))}
      </div>
    </section>
  );
}
