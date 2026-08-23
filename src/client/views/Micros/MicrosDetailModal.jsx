import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Cell as RCell } from "recharts";
import { pctColor } from "./utils.js";

export default function MicrosDetailModal({ nutrient, week, weekData, onClose }) {
  const { key, label, unit } = nutrient;
  const status = weekData?.rda_comparison?.[key];
  const dayBreakdown = weekData?.day_breakdown || {};
  const mealBreakdown = weekData?.meal_breakdown || {};
  const dates = weekData?.dates || [];

  const chartData = dates.map((date) => ({
    date: date.slice(5), // MM-DD
    fullDate: date,
    value: dayBreakdown[date]?.[key] ?? 0,
  }));

  // Standardmäßig der letzte Tag mit Daten für diesen Nährstoff — Klick auf
  // einen Balken wechselt die Auswahl (siehe Bar onClick unten).
  const defaultDate = useMemo(() => {
    const withData = [...chartData].reverse().find((d) => d.value > 0);
    return (withData || chartData[chartData.length - 1])?.fullDate;
  }, [weekData, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const activeDate = selectedDate && dates.includes(selectedDate) ? selectedDate : defaultDate;

  const contributions = (mealBreakdown[activeDate] || [])
    .map((entry) => ({ ...entry, value: entry.micros?.[key] ?? 0 }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);
  const activeDayTotal = dayBreakdown[activeDate]?.[key] ?? 0;

  // Top-Beiträge über die GANZE Woche (nicht nur den angeklickten Tag) — ohne
  // das lässt sich ein einzelner Ausreißer (z.B. eine Gemini-Mikros-Schätzung,
  // die für ein Meal völlig unplausible 1200mg Omega-3 liefert und damit den
  // Wochenschnitt verzerrt) nur durch Tag-für-Tag-Durchklicken finden.
  const weekTopContributions = dates
    .flatMap((date) => (mealBreakdown[date] || []).map((entry) => ({ ...entry, date, value: entry.micros?.[key] ?? 0 })))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const weekMax = weekTopContributions[0]?.value || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-white/10 max-h-[90vh] overflow-y-auto"
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
                <Bar
                  dataKey="value"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(d) => d?.fullDate && setSelectedDate(d.fullDate)}
                >
                  {chartData.map((d, i) => {
                    const color = pctColor(status ? Math.round((d.value / status.dach) * 100) : null).bg;
                    const isActive = d.fullDate === activeDate;
                    return (
                      <RCell
                        key={i}
                        fill={color}
                        stroke={isActive ? "#e2e8f0" : "transparent"}
                        strokeWidth={isActive ? 2 : 0}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-[11px] text-slate-600">
            Gestrichelte Linie = DACH-Tagesreferenz ({status?.dach ?? "—"} {unit}). Balken anklicken für Beiträge dieses Tages.
          </p>

          {weekTopContributions.length > 0 && (
            <div className="mt-5 border-t border-white/10 pt-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Top-Beiträge diese Woche
              </h4>
              <ul className="space-y-1.5">
                {weekTopContributions.map((entry, i) => {
                  const pct = weekMax > 0 ? Math.round((entry.value / weekMax) * 100) : 0;
                  return (
                    <li key={i}
                      role="button"
                      onClick={() => setSelectedDate(entry.date)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition ${entry.date === activeDate ? "bg-violet-400/10 ring-1 ring-violet-400/30" : "bg-white/5 hover:bg-white/10"}`}>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-slate-200">
                          {entry.kind === "supplement" ? "💊 " : "🍽 "}{entry.name}
                          <span className="ml-2 text-[10px] font-normal text-slate-500">{entry.date.slice(5).split("-").reverse().join(".")}</span>
                        </div>
                        <div className="h-1 mt-1 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full bg-amber-400/70" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-sm font-medium text-slate-200">
                        {entry.value} {unit}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[11px] text-slate-600">Sortiert nach höchstem Einzelbeitrag — Balken/Klick springt zum jeweiligen Tag unten.</p>
            </div>
          )}

          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Beiträge — {activeDate ? activeDate.slice(5).split("-").reverse().join(".") : "—"}
              </h4>
              <span className="text-xs text-slate-500">{activeDayTotal} {unit} gesamt</span>
            </div>
            {contributions.length === 0 ? (
              <p className="text-sm text-slate-600">Keine Einträge mit {label}-Beitrag an diesem Tag.</p>
            ) : (
              <ul className="space-y-1.5">
                {contributions.map((entry, i) => {
                  const pct = activeDayTotal > 0 ? Math.round((entry.value / activeDayTotal) * 100) : 0;
                  return (
                    <li key={i} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-slate-200">
                          {entry.kind === "supplement" ? "💊 " : "🍽 "}{entry.name}
                        </div>
                        <div className="h-1 mt-1 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full bg-violet-400/70" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-sm font-medium text-slate-200">
                        {entry.value} {unit}
                        <div className="text-[10px] font-normal text-slate-500">{pct}%</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
