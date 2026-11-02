import React, { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight, Check, CircleHelp, Microscope, Sparkles, Wand2 } from "lucide-react";
import { fetchJson } from "@api";
import { lastNWeeks } from "./Micros/utils.js";
import { readCache, writeCache } from "../lib/localCache.js";
import MicrosLegend from "./Micros/MicrosLegend.jsx";
import MicrosGrid from "./Micros/MicrosGrid.jsx";
import MicrosEstimator from "./Micros/MicrosEstimator.jsx";
import MicrosDetailModal from "./Micros/MicrosDetailModal.jsx";
import MicrosAiCoach from "./Micros/MicrosAiCoach.jsx";
import { NUTRIENTS } from "./Micros/utils.js";

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const cacheKey = (year, week) => `nutrition-weekly:${year}:${week}`;
const pct = (value) => Number.isFinite(value) ? `${Math.round(value)}%` : "—";

function Snapshot({ weeks, results }) {
  const latest = results.at(-1)?.data;
  const comparison = latest?.rda_comparison || {};
  const assessed = NUTRIENTS
    .map((nutrient) => ({ ...nutrient, ...(comparison[nutrient.key] || {}) }))
    .filter((nutrient) => nutrient.percent_of_dach != null && nutrient.dach > 0);
  const gaps = assessed.filter((nutrient) => nutrient.percent_of_dach < 90).sort((a, b) => a.percent_of_dach - b.percent_of_dach);
  const covered = assessed.filter((nutrient) => nutrient.percent_of_dach >= 90).length;
  const hasData = assessed.length > 0;
  const currentWeek = weeks.at(-1);

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.09] bg-slate-950/70 p-5 shadow-2xl shadow-black/20 sm:p-7">
      <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 right-1/3 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="relative grid gap-7 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.07] px-3 py-1.5 text-[11px] font-semibold tracking-wide text-cyan-100/80">
            <Microscope className="h-3.5 w-3.5" /> NUTRIENT INTELLIGENCE <span className="text-white/25">/</span> 8 WOCHEN
          </div>
          <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">Kleine Nährstoffe.<br /><span className="bg-gradient-to-r from-cyan-200 via-sky-100 to-violet-200 bg-clip-text text-transparent">Große Wirkung.</span></h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Dein Mikronährstoffmuster im Wochenverlauf. Tippe auf einen Wert, um Tagesverlauf, Einträge und Herkunft nachzuvollziehen.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400"><Check className="h-3.5 w-3.5 text-emerald-300" /> Referenz erreicht</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-white">{hasData ? `${covered}` : "—"}<span className="ml-1 text-sm font-medium text-slate-500">/ {assessed.length || "—"}</span></div>
            <div className="mt-1 text-[11px] text-slate-500">aktuelle Woche · ≥ 90% Referenz</div>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400"><AlertTriangle className="h-3.5 w-3.5 text-amber-300" /> Aufmerksamkeit</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-white">{hasData ? gaps.length : "—"}<span className="ml-1 text-sm font-medium text-slate-500">Nährstoffe</span></div>
            <div className="mt-1 truncate text-[11px] text-slate-500">{gaps[0] ? `Niedrigster Wert: ${gaps[0].label} · ${pct(gaps[0].percent_of_dach)}` : hasData ? "Kein Referenzwert unterschritten" : "Wird geladen …"}</div>
          </div>
        </div>
      </div>
      <div className="relative mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.07] pt-4 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />{currentWeek ? `Aktuell · KW ${currentWeek.week}, ${currentWeek.year}` : "Aktuelle Woche"}</span>
        <span className="inline-flex items-center gap-1.5"><CircleHelp className="h-3.5 w-3.5" />Nur Orientierungswerte; keine Obergrenzen-Bewertung.</span>
      </div>
    </section>
  );
}

function TrendNotes({ weeks, results }) {
  const notes = useMemo(() => {
    const recent = results.at(-1)?.data?.rda_comparison || {};
    const previous = results.slice(0, -1).map((result) => result.data?.rda_comparison || {});
    return NUTRIENTS.map((nutrient) => {
      const current = recent[nutrient.key];
      const past = previous.map((week) => week[nutrient.key]?.percent_of_dach).filter(Number.isFinite);
      if (current?.percent_of_dach == null || current.dach <= 0 || !past.length) return null;
      const baseline = past.reduce((sum, value) => sum + value, 0) / past.length;
      return { ...nutrient, current: current.percent_of_dach, delta: current.percent_of_dach - baseline };
    }).filter(Boolean);
  }, [results]);
  const gaps = notes.filter((note) => note.current < 90).sort((a, b) => a.current - b.current).slice(0, 3);
  const improving = notes.filter((note) => note.delta >= 5).sort((a, b) => b.delta - a.delta).slice(0, 2);

  if (!weeks.length) return null;
  return (
    <section className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-2xl border border-amber-200/[0.12] bg-gradient-to-br from-amber-300/[0.07] to-transparent p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-100/75"><AlertTriangle className="h-4 w-4" /> Im Blick behalten</div>
        {gaps.length ? <div className="mt-4 space-y-3">{gaps.map((item) => <div key={item.key} className="flex items-center justify-between gap-4"><div className="min-w-0"><div className="text-sm font-medium text-slate-100">{item.label}</div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-amber-300" style={{ width: `${Math.min(100, Math.max(0, item.current))}%` }} /></div></div><div className="shrink-0 text-right"><span className="text-sm font-semibold text-amber-100">{pct(item.current)}</span><div className="text-[10px] text-slate-500">diese Woche</div></div></div>)}</div> : <p className="mt-3 text-sm leading-6 text-slate-400">{notes.length ? "Aktuell liegt kein erfasster Referenzwert unter 90%." : "Sobald Wochenwerte vorliegen, erscheinen hier wiederkehrende Lücken."}</p>}
      </div>
      <div className="rounded-2xl border border-emerald-200/[0.12] bg-gradient-to-br from-emerald-300/[0.06] to-transparent p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-100/75"><Sparkles className="h-4 w-4" /> Positive Entwicklung <span className="normal-case tracking-normal text-slate-500">vs. Ø der vorherigen Wochen</span></div>
        {improving.length ? <div className="mt-4 space-y-3">{improving.map((item) => <div key={item.key} className="flex items-center justify-between gap-3"><div className="text-sm font-medium text-slate-100">{item.label}</div><div className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-200"><ArrowUpRight className="h-4 w-4" />+{Math.round(item.delta)} pp</div></div>)}</div> : <p className="mt-3 text-sm leading-6 text-slate-400">{notes.length ? "Deine aktuelle Woche liegt nahe am bisherigen Mittel." : "Trends werden sichtbar, sobald genug Wochenwerte vorliegen."}</p>}
      </div>
    </section>
  );
}

function LoadingState() {
  return <div className="space-y-2" aria-label="Mikronährstoffdaten werden geladen"><div className="h-10 animate-pulse rounded-xl bg-white/[0.04]" />{NUTRIENTS.slice(0, 8).map((item) => <div key={item.key} className="h-10 animate-pulse rounded-lg bg-white/[0.025]" />)}</div>;
}

const DRILLDOWN_KEY = "fuel:micros-entry-focus";

export default function MicrosView({ setActiveDate, setActiveTab }) {
  const [estimatorOpen, setEstimatorOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const weeks = lastNWeeks(8);
  const results = useQueries({
    queries: weeks.map(({ year, week }) => ({
      queryKey: ["nutrition-weekly", "trace-v2", year, week],
      queryFn: () => fetchJson(`/nutrition/weekly/${year}/${week}`).then((data) => {
        if (data.ok) writeCache(cacheKey(year, week), data);
        return data.ok ? data : null;
      }),
      placeholderData: () => {
        const cached = readCache(cacheKey(year, week), CACHE_MAX_AGE_MS);
        return cached?.trace_version === 2 ? cached : undefined;
      },
      staleTime: 5 * 60 * 1000,
    })),
  });
  const missingMeals = Array.from(new Set(results.flatMap((result) => result.data?.missing_meals || []).filter(Boolean)));
  const loading = results.some((result) => result.isPending);
  const failed = results.some((result) => result.isError);
  const openContribution = (entry, date) => {
    if (!entry?.id || !setActiveDate || !setActiveTab) return;
    try {
      sessionStorage.setItem(DRILLDOWN_KEY, JSON.stringify({ date, kind: entry.kind, entryId: entry.id }));
    } catch { /* Navigation still works if session storage is unavailable. */ }
    setActiveDate(date);
    setActiveTab(entry.kind === "supplement" ? "supplements" : "log");
  };

  return (
    <main className="mx-auto max-w-[1440px] space-y-5 p-3 pb-10 sm:space-y-6 sm:p-6">
      <Snapshot weeks={weeks} results={results} />
      <TrendNotes weeks={weeks} results={results} />

      <section className="overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-slate-900/55 shadow-xl shadow-black/10">
        <div className="flex flex-col gap-4 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200/70">Verlauf & Details</div><h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Deine Mikronährstoffe</h2><p className="mt-1 text-xs text-slate-500">Ø pro Tag im Vergleich zum Referenzwert · KW = Kalenderwoche</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setCoachOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-violet-300/20 bg-violet-400/[0.09] px-3.5 text-xs font-semibold text-violet-100 transition hover:border-violet-200/40 hover:bg-violet-400/[0.15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"><Sparkles className="h-4 w-4 text-violet-200" />AI Coach</button>
            {missingMeals.length > 0 && <button type="button" onClick={() => setEstimatorOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.08] px-3.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"><Wand2 className="h-4 w-4" />Lücken ergänzen <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">{missingMeals.length}</span></button>}
          </div>
        </div>
        <div className="p-4 sm:p-6">
          {loading && results.every((result) => !result.data) ? <LoadingState /> : <MicrosGrid weeks={weeks} results={results} onCellClick={(nutrient, week, weekData) => setDetail({ nutrient, week, weekData })} />}
          {failed && <div role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] p-3 text-xs leading-5 text-amber-100/80"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Einzelne Wochen konnten nicht geladen werden. Vorhandene Werte und gespeicherter Cache bleiben sichtbar.</div>}
          <div className="mt-5 border-t border-white/[0.06] pt-4"><MicrosLegend /><p className="mt-3 max-w-4xl text-[11px] leading-5 text-slate-500">Mikrowerte sind Näherungen aus erfassten Mahlzeiten und Supplements. Ein fehlender Eintrag kann wie 0 in den Wochenmittelwert eingehen; die Abdeckung daher immer im Detail prüfen. Referenzwerte sind Orientierungswerte für Erwachsene und keine Diagnose.</p></div>
        </div>
      </section>
      {coachOpen && <MicrosAiCoach weeks={weeks} results={results} onClose={() => setCoachOpen(false)} />}
      {estimatorOpen && <MicrosEstimator missingMeals={missingMeals} onClose={() => setEstimatorOpen(false)} />}
      {detail && <MicrosDetailModal nutrient={detail.nutrient} week={detail.week} weekData={detail.weekData} onOpenEntry={setActiveTab ? openContribution : undefined} onClose={() => setDetail(null)} />}
    </main>
  );
}
