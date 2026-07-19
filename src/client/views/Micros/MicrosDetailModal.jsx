import { X } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Cell as RCell } from "recharts";
import { pctColor } from "./utils.js";

export default function MicrosDetailModal({ nutrient, week, weekData, onClose }) {
  const { key, label, unit } = nutrient;
  const status = weekData?.rda_comparison?.[key];
  const dayBreakdown = weekData?.day_breakdown || {};

  const chartData = (weekData?.dates || []).map((date) => ({
    date: date.slice(5), // MM-DD
    value: dayBreakdown[date]?.[key] ?? 0,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <div>
            <h3 className="font-semibold text-slate-100">{label} <span className="text-sm font-normal text-slate-500">({unit})</span></h3>
            <p className="text-xs text-slate-400">KW{week.week}/{week.year} — Tagesverlauf</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {status ? (
            <div className="mb-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-lg font-semibold text-slate-100">{status.avg_daily}</div>
                <div className="text-[10px] uppercase text-slate-500">Ø/Tag</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-lg font-semibold text-slate-100">{status.dach}</div>
                <div className="text-[10px] uppercase text-slate-500">DACH-Ref.</div>
              </div>
              <div
                className="rounded-xl p-3"
                style={{ background: pctColor(status.percent_of_dach).bg }}
              >
                <div className="text-lg font-semibold text-white">{status.percent_of_dach}%</div>
                <div className="text-[10px] uppercase text-white/80">Erreicht</div>
              </div>
            </div>
          ) : (
            <p className="mb-4 text-sm text-slate-500">Keine Daten für diese Woche.</p>
          )}

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                  formatter={(v) => [`${v} ${unit}`, label]}
                />
                {status && (
                  <ReferenceLine y={status.dach} stroke="rgba(255,255,255,0.35)" strokeDasharray="4 4" />
                )}
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((d, i) => (
                    <RCell key={i} fill={pctColor(status ? Math.round((d.value / status.dach) * 100) : null).bg} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-[11px] text-slate-600">
            Gestrichelte Linie = DACH-Tagesreferenz ({status?.dach ?? "—"} {unit}).
          </p>
        </div>
      </div>
    </div>
  );
}
