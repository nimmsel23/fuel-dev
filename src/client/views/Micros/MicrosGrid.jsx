import React from "react";
import { NUTRIENTS, pctColor } from "./utils.js";

function Cell({ pct, dach, unit, avg, onClick }) {
  const { bg, text } = pctColor(pct);
  const formattedAvg = avg == null ? null : Number(avg).toLocaleString("de-AT", { maximumFractionDigits: 1 });
  const formattedPct = pct == null ? null : Math.round(pct);
  const title = pct != null
    ? `${formattedAvg} ${unit}/Tag · ${dach} ${unit} Referenz · ${formattedPct}% — Details öffnen`
    : avg != null ? `${formattedAvg} ${unit}/Tag · Referenzwert nicht verfügbar — Details öffnen` : "Keine Daten für diese Woche — Details öffnen";

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="group relative flex h-10 min-w-[3.1rem] w-full items-center justify-center rounded-lg text-[10px] font-semibold tabular-nums transition duration-150 hover:z-10 hover:scale-[1.04] hover:ring-2 hover:ring-white/50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 active:scale-[0.98]"
      style={{ background: bg, color: text }}
    >
      {pct != null ? `${formattedPct}%` : formattedAvg != null ? formattedAvg : "—"}
    </button>
  );
}

export default function MicrosGrid({ weeks, results, onCellClick }) {
  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[690px] gap-x-1.5 gap-y-1.5"
        style={{ gridTemplateColumns: `7rem repeat(${weeks.length}, 1fr)` }}
      >
        <div />
        {weeks.map(({ year, week }, i) => (
          <div key={`${year}-${week}`} className="pb-1 text-center">
            <div className="text-[10px] font-semibold text-slate-300">KW {week}</div>
            <div className="text-[9px] tabular-nums text-slate-600">{year}</div>
          </div>
        ))}

        {NUTRIENTS.map(({ key, label, unit }) => (
          <React.Fragment key={key}>
            <div className="sticky left-0 z-[1] flex items-center rounded-l-lg bg-slate-900/95 pr-2 text-xs font-medium text-slate-200 sm:text-sm">
              {label}
              <span className="ml-1 text-[10px] text-slate-500">{unit}</span>
            </div>
            {results.map((res, wi) => {
              const d = res.data?.rda_comparison?.[key];
              return (
                <Cell
                  key={`${key}-${wi}`}
                  pct={d?.percent_of_dach ?? null}
                  dach={d?.dach ?? null}
                  unit={unit}
                  avg={d?.avg_daily ?? null}
                  onClick={() => onCellClick?.({ key, label, unit }, weeks[wi], res.data)}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
