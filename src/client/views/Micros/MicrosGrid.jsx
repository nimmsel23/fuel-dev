import React from "react";
import { useQueries } from "@tanstack/react-query";
import { fetchJson } from "@api";
import { lastNWeeks, NUTRIENTS, pctColor } from "./utils.js";

function Cell({ pct, dach, unit, avg }) {
  const { bg, text } = pctColor(pct);
  const title = pct != null
    ? `${avg} ${unit} / ${dach} ${unit} DACH (${pct}%)`
    : "Keine Daten";

  return (
    <div
      title={title}
      className="flex h-9 w-full items-center justify-center rounded text-[10px] font-semibold transition-opacity"
      style={{ background: bg, color: text }}
    >
      {pct != null ? `${pct}%` : "—"}
    </div>
  );
}

export default function MicrosGrid({ weeks, results }) {
  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[640px] gap-1"
        style={{ gridTemplateColumns: `7rem repeat(${weeks.length}, 1fr)` }}
      >
        <div />
        {weeks.map(({ year, week }, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-slate-500">
            KW{week}
          </div>
        ))}

        {NUTRIENTS.map(({ key, label, unit }) => (
          <React.Fragment key={key}>
            <div className="flex items-center pr-2 text-sm font-medium text-slate-300">
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
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
