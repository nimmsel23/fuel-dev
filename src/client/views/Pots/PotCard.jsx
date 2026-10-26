import { useState } from "react";
import { Trash2, Plus, Check } from "lucide-react";
import { twMerge } from "tailwind-merge";
import {
  PRESETS, eatenFraction, remainingFraction, isFinished, maxFractionFor, daySlots,
  scaledMacros, formatPct,
} from "../../lib/potsLogic.js";
import { todayISO } from "../../lib/db/firestore/utils.js";

function dayLabel(date, today) {
  const diff = Math.round((new Date(`${today}T12:00:00`) - new Date(`${date}T12:00:00`)) / 86400000);
  const short = new Date(`${date}T12:00:00`).toLocaleDateString("de-AT", { weekday: "short", day: "2-digit", month: "2-digit" });
  if (diff === 0) return `Heute · ${short}`;
  if (diff === 1) return `Gestern · ${short}`;
  return short;
}

const macroLine = (m) => `${m.kcal} kcal · P${m.protein} · C${m.carbs} · F${m.fat}`;

// Ein Tag auf der Timeline: gegessener Anteil + Schnellwahl (¼ … ¾, Rest) + freie Prozent-Eingabe.
function DayNode({ pot, date, today, onSet, isCooked }) {
  const entry = pot.days?.[date];
  const fraction = entry?.fraction || 0;
  const max = maxFractionFor(pot, date);
  const restLabel = formatPct(max);

  const commit = (value) => {
    const pct = Number(String(value).replace(",", "."));
    if (!Number.isFinite(pct)) return;
    onSet(date, pct / 100);
  };

  return (
    <div className="relative pb-5 last:pb-0">
      <span className={twMerge(
        "absolute -left-[19px] top-[3px] h-2.5 w-2.5 rounded-full border-2 bg-slate-950",
        fraction > 0 ? "border-orange-400 bg-orange-400" : "border-white/25",
      )} />
      <div className="mb-1 flex items-center gap-2 font-mono text-[10.5px] text-slate-500">
        <span>{dayLabel(date, today)}</span>
        {isCooked && <span className="rounded-full bg-orange-400/10 px-1.5 py-0.5 text-[9.5px] font-semibold text-orange-300">gekocht</span>}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className={twMerge("text-sm font-medium", fraction > 0 ? "text-slate-100" : "text-slate-500")}>
            {fraction > 0 ? `${formatPct(fraction)} gegessen` : "noch nichts gegessen"}
          </span>
          {fraction > 0 && <span className="text-[11px] tabular-nums text-slate-500">{macroLine(scaledMacros(pot.macros, fraction))}</span>}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-300 transition-all" style={{ width: `${Math.min(100, fraction * 100)}%` }} />
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => {
            const disabled = p.value > max + 0.005;
            const active = Math.abs(fraction - p.value) < 0.005;
            return (
              <button key={p.label} type="button" disabled={disabled} onClick={() => onSet(date, active ? 0 : p.value)}
                className={twMerge(
                  "min-w-[2.25rem] rounded-lg border px-2 py-1 text-sm font-semibold tabular-nums transition",
                  active ? "border-orange-400/60 bg-orange-400/20 text-orange-200" : "border-white/10 text-slate-300 hover:bg-white/10",
                  disabled && "cursor-not-allowed opacity-30 hover:bg-transparent",
                )}>
                {p.label}
              </button>
            );
          })}
          <button type="button" disabled={max <= 0 || Math.abs(fraction - max) < 0.005} onClick={() => onSet(date, max)}
            title="Den ganzen Rest essen"
            className={twMerge(
              "rounded-lg border px-2 py-1 text-sm font-semibold transition",
              Math.abs(fraction - max) < 0.005 && fraction > 0 ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-200" : "border-white/10 text-slate-300 hover:bg-white/10",
              (max <= 0) && "cursor-not-allowed opacity-30",
            )}>
            Rest · {restLabel}
          </button>
          <label className="ml-auto flex items-center gap-1 text-xs text-slate-500">
            <input type="number" inputMode="numeric" min={0} max={100} step={5} key={`${date}-${fraction}`}
              defaultValue={fraction > 0 ? Math.round(fraction * 100) : ""} placeholder="–"
              onBlur={(e) => e.target.value !== String(Math.round(fraction * 100)) && commit(e.target.value || 0)}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              className="w-14 rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1 text-right text-sm tabular-nums text-slate-100 outline-none focus:border-orange-400/50" />
            %
          </label>
          {fraction > 0 && (
            <button type="button" onClick={() => onSet(date, 0)} title="Eintrag dieses Tages entfernen"
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-red-400/10 hover:text-red-400">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PotCard({ pot, onSetDay, onDelete }) {
  const today = todayISO();
  const [extraDays, setExtraDays] = useState([]);
  const [addDate, setAddDate] = useState("");
  const eaten = eatenFraction(pot);
  const rest = remainingFraction(pot);
  const finished = isFinished(pot);
  const slots = daySlots(pot, today, extraDays);

  return (
    <section className={twMerge("rounded-3xl border bg-white/5 p-5 backdrop-blur", finished ? "border-white/5 opacity-80" : "border-white/10")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-slate-100">{pot.name}</h3>
          <p className="mt-0.5 text-xs text-slate-500">Ganzer Topf: {macroLine({ kcal: Math.round(pot.macros.kcal), protein: pot.macros.protein, carbs: pot.macros.carbs, fat: pot.macros.fat })}</p>
          {pot.ingredients && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{pot.ingredients}</p>}
        </div>
        <button type="button" title="Topf löschen"
          onClick={() => window.confirm(`„${pot.name}" löschen? Bereits geloggte Mahlzeiten bleiben im Log erhalten.`) && onDelete(pot.id)}
          className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-red-400/10 hover:text-red-400">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between text-xs">
          <span className="font-semibold text-orange-300">{formatPct(eaten)} gegessen</span>
          <span className={finished ? "flex items-center gap-1 font-semibold text-emerald-300" : "text-slate-400"}>
            {finished ? <><Check className="h-3.5 w-3.5" /> aufgegessen</> : `Rest ${formatPct(rest)} · ${macroLine(scaledMacros(pot.macros, rest))}`}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
          <div className={twMerge("h-full rounded-full transition-all", finished ? "bg-emerald-400/70" : "bg-gradient-to-r from-orange-400 to-amber-300")} style={{ width: `${Math.min(100, eaten * 100)}%` }} />
        </div>
      </div>

      <div className="relative mt-5 pl-8">
        <div className="absolute bottom-1 left-[13px] top-1 w-px bg-gradient-to-b from-orange-400/50 to-white/5" aria-hidden />
        {slots.map((date) => (
          <DayNode key={date} pot={pot} date={date} today={today} isCooked={date === pot.cooked_on}
            onSet={(d, f) => onSetDay(pot.id, d, f)} />
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 pl-8">
        <input type="date" value={addDate} max={today} min={pot.cooked_on} onChange={(e) => setAddDate(e.target.value)}
          className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1 text-xs text-slate-300 outline-none focus:border-orange-400/50" />
        <button type="button" disabled={!addDate || slots.includes(addDate)}
          onClick={() => { setExtraDays((d) => [...d, addDate]); setAddDate(""); }}
          className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-300 transition hover:bg-white/10 disabled:opacity-30">
          <Plus className="h-3 w-3" /> Tag ergänzen
        </button>
      </div>
    </section>
  );
}
