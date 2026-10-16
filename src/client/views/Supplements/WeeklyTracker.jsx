import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { addDays, addWeeks, format, parseISO, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarDays, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { suppLogOptions } from "../../hooks/useSupplements.js";
import { formatMetric, normalizeSupplementUnit } from "../../../shared/utils/utils.js";
import { isDueToday } from "./utils.js";
import { useSupplementMutations } from "./useSupplementMutations.js";

export default function WeeklyTracker({ date, catalog, onDateChange }) {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const start = startOfWeek(addWeeks(parseISO(date), offset), { weekStartsOn: 1 });
  const dates = Array.from({ length: 7 }, (_, i) => format(addDays(start, i), "yyyy-MM-dd"));
  const today = format(new Date(), "yyyy-MM-dd");
  const queries = useQueries({ queries: dates.map(suppLogOptions) });
  const { createIntake, deleteIntake } = useSupplementMutations(date);
  const visible = catalog.filter(item => item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));

  function toggle(item, day, intakes) {
    const last = intakes.filter(intake => intake.supplement_id === item.id).at(-1);
    if (last) deleteIntake.mutate({ date: day, delete_id: last.id });
    else createIntake.mutate({ date: day, supplement_id: item.id, name: item.name,
      dose: item.default_dose ?? 0, unit: normalizeSupplementUnit(item.unit),
      time_of_day: item.default_time_of_day || "any" });
  }

  return (
    <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5" aria-label="Supplement-Wochentracker">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold"><CalendarDays className="h-5 w-5 text-lime-300" /> Dein Wochentracker</h3>
          <p className="mt-1 text-sm text-slate-400">{format(start, "d. MMM", { locale: de })} – {format(addDays(start, 6), "d. MMM yyyy", { locale: de })}</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Vorige Woche" onClick={() => setOffset(offset - 1)} className="rounded-full p-3 hover:bg-white/10"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" onClick={() => setOffset(0)} className="rounded-full border border-white/10 px-3 py-2 text-xs">Gewählte Woche</button>
          <button type="button" aria-label="Nächste Woche" onClick={() => setOffset(offset + 1)} className="rounded-full p-3 hover:bg-white/10"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>
      <p className="text-sm text-slate-400">Ein Tag pro Kästchen. Antippen erfasst eine Einnahme oder entfernt die letzte. Änderungen erscheinen sofort; die Cloud synchronisiert im Hintergrund.</p>
      <input type="search" aria-label="Supplement im Wochentracker suchen" placeholder="Supplement suchen…" value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm" />
      <div className="space-y-3">
        {visible.map(item => {
          const takenDays = queries.filter(query => query.data?.intakes?.some(intake => intake.supplement_id === item.id)).length;
          const plannedDays = dates.filter(day => isDueToday(item, day)).length;
          return (
            <article key={item.id} className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/40 p-3 sm:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div><h4 className="break-words font-semibold">{item.name}</h4><p className="text-xs text-slate-400">{formatMetric(item.default_dose ?? 0)} {normalizeSupplementUnit(item.unit)}</p></div>
                <span className="text-xs text-slate-400">{takenDays} Einnahmetage · {plannedDays} geplant</span>
              </div>
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {dates.map((day, index) => {
                  const query = queries[index];
                  const intakes = query.data?.intakes || [];
                  const count = intakes.filter(intake => intake.supplement_id === item.id).length;
                  const planned = isDueToday(item, day);
                  const future = day > today;
                  const unavailable = !query.data || query.isError;
                  const label = count ? `${count} Einnahme${count > 1 ? "n" : ""}. Letzte entfernen` : future ? "Zukünftiger Tag" : planned ? "Geplant. Einnahme erfassen" : "Planfrei. Einnahme erfassen";
                  return (
                    <button key={day} type="button" aria-pressed={count > 0} aria-label={`${item.name}, ${format(parseISO(day), "EEEE, d. MMMM", { locale: de })}: ${unavailable ? "Daten noch nicht verfügbar" : label}`} title={label}
                      disabled={future || unavailable} onClick={() => toggle(item, day, intakes)}
                      className={`flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border text-xs transition disabled:cursor-default ${count ? "border-lime-300/50 bg-lime-300/15 text-lime-200" : planned ? "border-white/20 bg-white/5 text-slate-200" : "border-dashed border-white/10 text-slate-500"} ${day === today ? "ring-1 ring-lime-300/60" : ""} ${future ? "opacity-50" : "hover:border-lime-300/50"}`}>
                      <span>{format(parseISO(day), "EE", { locale: de })}</span>
                      <span className="flex h-5 items-center justify-center">{unavailable ? "…" : count ? <Check className="h-5 w-5" /> : planned ? "○" : "–"}</span>
                      <span className="text-[10px]">{format(parseISO(day), "d.")}{count > 1 ? ` · ${count}×` : ""}</span>
                    </button>
                  );
                })}
              </div>
            </article>
          );
        })}
        {!visible.length && <p className="py-4 text-sm text-slate-400">Keine passenden Supplements.</p>}
      </div>
      <p className="text-xs text-slate-500">✓ Erfasst · ○ Geplant · – Planfrei · Umrandung: Heute. Zukünftige Tage zeigen nur den Plan.</p>
      {queries.some(query => query.isError) && <div role="alert" className="text-sm text-rose-300">Einige Tage konnten nicht geladen werden. <button type="button" onClick={() => queries.filter(query => query.isError).forEach(query => query.refetch())} className="underline">Erneut laden</button></div>}
      {(createIntake.isError || deleteIntake.isError) && <p role="alert" className="text-sm text-rose-300">{createIntake.error?.message || deleteIntake.error?.message}</p>}
      {onDateChange && <button type="button" onClick={() => { setOffset(0); onDateChange(today); }} className="text-xs text-lime-200 underline">Zur aktuellen Woche</button>}
    </section>
  );
}
