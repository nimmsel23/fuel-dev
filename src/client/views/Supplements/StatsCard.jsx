import { Pill } from "lucide-react";
import { Empty } from "../../components/ui.jsx";

export default function StatsCard({ stats }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        <Pill className="h-5 w-5 text-violet-300" />
        <h3 className="text-lg font-semibold">Letzte 30 Tage</h3>
      </div>
      <p className="mb-4 text-sm text-slate-400">Einnahmetage bis zum ausgewählten Datum. Mehrere Einnahmen am selben Tag zählen als ein Tag.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {stats.length ? stats.map((row) => (
          <div key={row.supplement.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <strong>{row.supplement.name}</strong>
              <span className="text-xs text-slate-400">{row.days_taken} Tage</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">Serie: {row.current_streak} Tage</p>
          </div>
        )) : <Empty text="Noch keine Einnahmen im gewählten Zeitraum." />}
      </div>
    </section>
  );
}
