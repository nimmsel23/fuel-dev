import { useMemo, useState } from "react";
import { ArrowUpRight, Copy, Link2, X } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Cell as RCell } from "recharts";
import { pctColor } from "./utils.js";

function provenanceLabel(entry) {
  const meta = entry?.micros_meta || null;
  if (!meta) return null;
  if (meta.origin === "supplement") return "Supplement-Katalog";
  if (meta.origin === "fresh_estimate") return "frisch geschätzt";
  if (meta.origin === "background_estimate") return "geschätzt im Hintergrund";
  if (meta.origin === "cloud_cache_lookup") return "Cloud-Micros-Katalog";
  if (meta.origin === "cache_lookup") return "lokaler Micros-Cache";
  return meta.source || "Micros";
}

function timeLabel(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
}

function componentLabel(component) {
  const amount = component.amount_g != null ? `${component.amount_g} g` : component.qty_text || component.qty || "Menge offen";
  return `${component.name || component.description || "Zutat"} · ${amount}`;
}

function componentNutrient(component, nutrientKey) {
  const per100g = component.per_100g || null;
  const profile = per100g?.micros && typeof per100g.micros === "object" ? per100g.micros : per100g;
  const raw = profile?.[nutrientKey];
  const source = component.micros_source || per100g?.micros_source || per100g?.source || null;
  if (raw == null || !Number.isFinite(Number(raw))) {
    return { value: null, source, reason: profile ? "nutrient_missing" : "profile_missing" };
  }
  const grams = Number(component.amount_g);
  if (!(grams > 0)) return { value: null, source, reason: "amount_missing" };
  return { value: Number(raw) * grams / 100, per100g: Number(raw), grams, source, reason: null };
}

function formatMicro(value, unit) {
  return `${Number(value).toLocaleString("de-AT", { maximumFractionDigits: 3 })} ${unit}`;
}

function componentSourceLabel(source) {
  if (!source) return "Quelle im Zutatenprofil nicht dokumentiert";
  if (/usda|bls|souci|efsa|etikett|hersteller/i.test(source)) return source;
  return `Profilquelle: ${source}`;
}

export default function MicrosDetailModal({ nutrient, week, weekData, onClose, onOpenEntry }) {
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
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [copiedId, setCopiedId] = useState(false);
  const componentTrace = useMemo(() => {
    if (selectedEntry?.kind !== "meal") return null;
    const rows = (selectedEntry.components || []).map((component) => ({
      component,
      trace: componentNutrient(component, key),
    }));
    const known = rows.filter((row) => row.trace.value != null);
    return {
      rows,
      known,
      knownTotal: known.reduce((sum, row) => sum + row.trace.value, 0),
    };
  }, [selectedEntry, key]);
  const activeDate = selectedDate && dates.includes(selectedDate) ? selectedDate : defaultDate;

  const contributions = (mealBreakdown[activeDate] || [])
    .map((entry) => ({ ...entry, date: activeDate, value: entry.micros?.[key] ?? 0 }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);
  const activeDayTotal = dayBreakdown[activeDate]?.[key] ?? 0;
  const selectedDayTotal = selectedEntry ? dayBreakdown[selectedEntry.date || activeDate]?.[key] ?? 0 : 0;
  const selectedDayShare = selectedDayTotal > 0
    ? Math.round(((selectedEntry?.value ?? selectedEntry?.micros?.[key] ?? 0) / selectedDayTotal) * 100)
    : null;
  const omega3NeedsReview = selectedEntry?.kind === "meal"
    && key.startsWith("omega3")
    && selectedDayShare >= 80
    && componentTrace?.known.length === 0;

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
                <div className="text-lg font-semibold text-slate-100">{status.avg_daily ?? "—"}</div>
                <div className="text-[10px] uppercase text-slate-500">Ø/Tag</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-lg font-semibold text-slate-100">{status.dach ?? "—"}</div>
                <div className="text-[10px] uppercase text-slate-500">Referenz</div>
              </div>
              <div
                className="rounded-xl p-3"
                style={{ background: pctColor(status.percent_of_dach).bg }}
              >
                <div className="text-lg font-semibold text-white">{status.percent_of_dach != null ? `${status.percent_of_dach}%` : "—"}</div>
                <div className="text-[10px] uppercase text-white/80">Erreicht</div>
              </div>
            </div>
          ) : (
            <p className="mb-4 text-sm text-slate-500">Keine Daten für diese Woche.</p>
          )}

          {key.startsWith("omega3") && <p className="mb-4 text-xs text-slate-400">
            ALA, EPA, DHA und DPA werden getrennt erfasst. 250 mg ist die EFSA-Referenz für EPA + DHA.
            Bekannte Mengen sind bei fehlenden Detailwerten eine Teilsumme, kein vollständiges Profil.
            {status?.coverage && ` Datenlage: ${status.coverage === "complete" ? "vollständig für erfasste Einträge" : status.coverage === "partial" ? "teilweise" : "unbekannt"} (${status.known_entries}/${status.total_entries} Einträge).`}
          </p>}
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
                {status?.dach > 0 && (
                  <ReferenceLine y={status.dach} stroke="rgba(255,255,255,0.35)" strokeDasharray="4 4" />
                )}
                <Bar
                  dataKey="value"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(d) => {
                    if (!d?.fullDate) return;
                    setSelectedDate(d.fullDate);
                    setSelectedEntry(null);
                  }}
                >
                  {chartData.map((d, i) => {
                    const color = pctColor(status?.dach > 0 ? Math.round((d.value / status.dach) * 100) : null).bg;
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
            Gestrichelte Linie = Tagesreferenz ({status?.dach ?? "—"} {unit}). Balken anklicken für Beiträge dieses Tages.
          </p>

          {weekTopContributions.length > 0 && (
            <div className="mt-5 border-t border-white/10 pt-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Top-Beiträge diese Woche
              </h4>
              <ul className="space-y-1.5">
                {weekTopContributions.map((entry, i) => {
                  const pct = weekMax > 0 ? Math.round((entry.value / weekMax) * 100) : 0;
                  const isSelected = selectedEntry?.id && selectedEntry.id === entry.id && selectedEntry.kind === entry.kind;
                  return (
                    <li key={entry.id || `${entry.date}-${entry.name}-${i}`}>
                      <button type="button"
                      onClick={() => { setSelectedDate(entry.date); setSelectedEntry(entry); }}
                      aria-pressed={Boolean(isSelected)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${isSelected ? "bg-cyan-400/10 ring-1 ring-cyan-300/40" : entry.date === activeDate ? "bg-violet-400/10 ring-1 ring-violet-400/30" : "bg-white/5 hover:bg-white/10"}`}>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-slate-200">
                          {entry.kind === "supplement" ? "💊 " : "🍽 "}{entry.name}
                          <span className="ml-2 text-[10px] font-normal text-slate-500">{entry.date.slice(5).split("-").reverse().join(".")}</span>
                        </div>
                        {entry.micros_meta && (
                          <div className="truncate text-[10px] text-slate-500">
                            {provenanceLabel(entry)}
                            {entry.micros_meta.lookup_name ? ` · via ${entry.micros_meta.lookup_name}` : ""}
                          </div>
                        )}
                        <div className="h-1 mt-1 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full bg-amber-400/70" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-sm font-medium text-slate-200">
                        {entry.value} {unit}
                      </div>
                      </button>
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
                  const isSelected = selectedEntry?.id && selectedEntry.id === entry.id && selectedEntry.kind === entry.kind;
                  return (
                    <li key={entry.id || `${entry.date}-${entry.name}-${i}`}>
                    <button type="button" onClick={() => setSelectedEntry(entry)} aria-pressed={Boolean(isSelected)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${isSelected ? "bg-cyan-400/10 ring-1 ring-cyan-300/40" : "bg-white/5 hover:bg-white/[0.08]"}`}>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-slate-200">
                          {entry.kind === "supplement" ? "💊 " : "🍽 "}{entry.name}
                        </div>
                        {entry.micros_meta && (
                          <div className="truncate text-[10px] text-slate-500">
                            {provenanceLabel(entry)}
                            {entry.micros_meta.lookup_name ? ` · via ${entry.micros_meta.lookup_name}` : ""}
                            {entry.micros_meta.inferred_from && entry.micros_meta.inferred_from !== entry.micros_meta.lookup_name ? ` · aus ${entry.micros_meta.inferred_from}` : ""}
                          </div>
                        )}
                        <div className="h-1 mt-1 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full bg-violet-400/70" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-sm font-medium text-slate-200">
                        {entry.value} {unit}
                        <div className="text-[10px] font-normal text-slate-500">{pct}%</div>
                      </div>
                    </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {selectedEntry && (
            <section className="mt-5 rounded-2xl border border-cyan-200/15 bg-gradient-to-br from-cyan-300/[0.07] to-slate-950/30 p-4" aria-live="polite">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/65">Konkreter Ursprungseintrag</div>
                  <h4 className="mt-1 font-semibold text-slate-100">{selectedEntry.name}</h4>
                  <p className="mt-1 text-xs text-slate-400">{selectedEntry.kind === "supplement" ? "Supplement-Einnahme" : "Mahlzeit"} · {selectedEntry.date || activeDate}{timeLabel(selectedEntry.time) ? ` · ${timeLabel(selectedEntry.time)} Uhr` : ""}</p>
                </div>
                <div className="rounded-xl bg-slate-950/60 px-3 py-2 text-right">
                  <div className="text-lg font-semibold tabular-nums text-white">{selectedEntry.value ?? selectedEntry.micros?.[key] ?? 0} {unit}</div>
                  <div className="text-[10px] text-slate-500">Beitrag für {label}</div>
                </div>
              </div>

              <dl className="mt-4 grid gap-x-5 gap-y-3 border-t border-white/[0.07] pt-3 text-xs sm:grid-cols-2">
                <div><dt className="text-slate-500">Stabile Eintrags-ID</dt><dd className="mt-1 flex items-center gap-2 font-mono text-[11px] text-slate-200">{selectedEntry.id || "In diesem älteren Eintrag nicht gespeichert"}{selectedEntry.id && <button type="button" title="ID kopieren" aria-label="Eintrags-ID kopieren" className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white" onClick={() => { navigator.clipboard?.writeText(selectedEntry.id).then(() => { setCopiedId(true); setTimeout(() => setCopiedId(false), 1500); }).catch(() => {}); }}><Copy className="h-3 w-3" /></button>}{copiedId && <span className="font-sans text-emerald-300">kopiert</span>}</dd></div>
                {selectedEntry.kind === "meal" ? (
                  <>
                    <div><dt className="text-slate-500">Menge & Energie</dt><dd className="mt-1 text-slate-200">{selectedEntry.grams != null ? `${selectedEntry.grams} g · ` : ""}{selectedEntry.kcal ?? 0} kcal · P {selectedEntry.protein ?? 0} g · KH {selectedEntry.carbs ?? 0} g · F {selectedEntry.fat ?? 0} g</dd></div>
                    {selectedEntry.catalog_item_id && <div><dt className="text-slate-500">Katalog-ID</dt><dd className="mt-1 break-all font-mono text-[11px] text-slate-200">{selectedEntry.catalog_item_id}</dd></div>}
                    {selectedEntry.components?.length > 0 && <div className="sm:col-span-2"><dt className="text-slate-500">Gespeicherte Bestandteile</dt><dd className="mt-1 flex flex-wrap gap-1.5">{selectedEntry.components.map((component, i) => <span key={`${component.name || "zutat"}-${i}`} className="rounded-lg border border-white/[0.07] bg-white/[0.035] px-2 py-1 text-[11px] text-slate-300">{componentLabel(component)}</span>)}</dd></div>}
                  </>
                ) : (
                  <>
                    <div><dt className="text-slate-500">Dosis</dt><dd className="mt-1 text-slate-200">{selectedEntry.dose ?? "—"} {selectedEntry.unit || ""}</dd></div>
                    {selectedEntry.supplement_id && <div><dt className="text-slate-500">Supplement-Katalog-ID</dt><dd className="mt-1 break-all font-mono text-[11px] text-slate-200">{selectedEntry.supplement_id}</dd></div>}
                  </>
                )}
                <div><dt className="text-slate-500">Wertquelle</dt><dd className="mt-1 text-slate-200">{provenanceLabel(selectedEntry) || selectedEntry.source || "Keine Herkunft mitgespeichert"}</dd></div>
                {selectedEntry.micros_meta?.lookup_name && <div><dt className="text-slate-500">Aufgelöst über</dt><dd className="mt-1 text-slate-200">{selectedEntry.micros_meta.lookup_name}</dd></div>}
                {selectedEntry.micros_meta?.inferred_from && <div><dt className="text-slate-500">Ursprünglicher Name / Schlüssel</dt><dd className="mt-1 break-all text-slate-200">{selectedEntry.micros_meta.inferred_from}</dd></div>}
                {selectedEntry.micros_meta?.method && <div><dt className="text-slate-500">Berechnungsweg</dt><dd className="mt-1 text-slate-200">{selectedEntry.micros_meta.method}</dd></div>}
                {selectedEntry.micros_meta?.reference_grams != null && <div><dt className="text-slate-500">Schätz-Bezugsmenge</dt><dd className="mt-1 text-slate-200">{selectedEntry.micros_meta.reference_grams} g</dd></div>}
                {selectedEntry.micros_meta?.scaling_factor != null && <div><dt className="text-slate-500">Portions-Skalierung</dt><dd className="mt-1 text-slate-200">×{Number(selectedEntry.micros_meta.scaling_factor).toLocaleString("de-AT", { maximumFractionDigits: 3 })}</dd></div>}
                {selectedEntry.micros_meta?.resolved_at && <div><dt className="text-slate-500">Wert aufgelöst</dt><dd className="mt-1 text-slate-200">{new Date(selectedEntry.micros_meta.resolved_at).toLocaleString("de-AT")}</dd></div>}
              </dl>

              {selectedEntry.kind === "meal" && (
                <div className="mt-4 rounded-xl border border-white/[0.07] bg-slate-950/45 p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h5 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Auf Zutatenebene · {label}</h5>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {selectedEntry.components_source === "catalog_current" ? "Zutaten aus dem aktuellen Katalog; kein historischer Meal-Snapshot." : selectedEntry.components_source === "meal_snapshot" ? "Zutaten-Snapshot des geloggten Eintrags." : "Für diesen Eintrag sind keine Zutatenprofile verfügbar."}
                      </p>
                    </div>
                    {componentTrace?.rows.length > 0 && <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] tabular-nums text-slate-400">{componentTrace.known.length}/{componentTrace.rows.length} mit {label}-Wert</span>}
                  </div>

                  {componentTrace?.rows.length ? (
                    <ul className="mt-3 divide-y divide-white/[0.06]">
                      {componentTrace.rows.map(({ component, trace }, i) => (
                        <li key={`${component.name || "zutat"}-${i}`} className="grid gap-1 py-2 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-200">{componentLabel(component)}</div>
                            <div className="mt-0.5 break-words text-[10px] leading-4 text-slate-500">
                              {trace.value != null ? componentSourceLabel(trace.source) : <>{trace.reason === "nutrient_missing" ? `${label} im gespeicherten Zutatenprofil nicht ausgewiesen` : trace.reason === "amount_missing" ? "Menge fehlt; Beiträge lassen sich nicht skalieren" : "Kein per-100-g-Mikroprofil gespeichert"}{trace.source ? ` · ${componentSourceLabel(trace.source)}` : ""}</>}
                            </div>
                          </div>
                          <div className={`text-xs font-semibold tabular-nums sm:text-right ${trace.value != null ? "text-cyan-100" : "text-slate-500"}`}>
                            {trace.value != null ? <>{formatMicro(trace.value, unit)} <span className="font-normal text-slate-500">({formatMicro(trace.per100g, unit)}/100 g)</span></> : "unbekannt"}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs leading-5 text-slate-400">Der gespeicherte Mikrowert lässt sich nicht auf Zutaten aufteilen. Es gibt keine Zutaten mit einem hinterlegten {label}-Profil.</p>
                  )}

                  {componentTrace?.known.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] pt-3 text-[11px]">
                      <span className="text-slate-400">Belegte Zutaten zusammen: <strong className="text-cyan-100">{formatMicro(componentTrace.knownTotal, unit)}</strong></span>
                      <span className="text-slate-500">Mahlzeit gesamt: {formatMicro(selectedEntry.value ?? selectedEntry.micros?.[key] ?? 0, unit)} · Differenz bleibt nicht zugeordnet</span>
                    </div>
                  )}

                  {selectedEntry.micros_meta?.source && /gemini|estimate|ai/i.test(`${selectedEntry.micros_meta.source} ${selectedEntry.micros_meta.method || ""}`) && componentTrace?.known.length === 0 && (
                    <p className="mt-3 rounded-lg border border-amber-200/15 bg-amber-200/[0.06] px-3 py-2 text-[11px] leading-5 text-amber-100/80">Der angezeigte Mahlzeitenwert ist eine Gesamtschätzung ({selectedEntry.micros_meta.source}); für {label} ist kein Zutatenbeitrag belegt. Er lässt sich daher nicht auf einzelne Zutaten zurückführen.</p>
                  )}
                  {omega3NeedsReview && (
                    <p className="mt-2 rounded-lg border border-amber-300/20 bg-amber-300/[0.08] px-3 py-2 text-[11px] leading-5 text-amber-100/90">Prüfhinweis: Dieser Eintrag erklärt {selectedDayShare}% des erfassten Omega-3-Tageswerts, aber kein Zutatenprofil belegt den Beitrag.</p>
                  )}
                </div>
              )}

              {selectedEntry.kind === "meal" && onOpenEntry && selectedEntry.id && (
                <button type="button" onClick={() => onOpenEntry(selectedEntry, selectedEntry.date || activeDate)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-200/[0.08] px-3.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-200/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"><Link2 className="h-4 w-4" />Mahlzeit im Log öffnen <ArrowUpRight className="h-3.5 w-3.5" /></button>
              )}
              {selectedEntry.kind === "supplement" && onOpenEntry && selectedEntry.id && (
                <button type="button" onClick={() => onOpenEntry(selectedEntry, selectedEntry.date || activeDate)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-lime-200/20 bg-lime-200/[0.08] px-3.5 text-xs font-semibold text-lime-100 transition hover:bg-lime-200/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200"><Link2 className="h-4 w-4" />Einnahme im Tageslog öffnen <ArrowUpRight className="h-3.5 w-3.5" /></button>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
