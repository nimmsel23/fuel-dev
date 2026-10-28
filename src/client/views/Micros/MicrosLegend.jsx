export default function MicrosLegend() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-slate-400" aria-label="Legende der Referenzabdeckung">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm ring-1 ring-emerald-200/20" style={{ background: "#16a34a" }} /> ≥ 90% Referenz
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm ring-1 ring-amber-200/20" style={{ background: "#d97706" }} /> 50–89%
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm ring-1 ring-rose-200/20" style={{ background: "#dc2626" }} /> &lt; 50%
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm border border-slate-600 bg-slate-800/60" /> Menge ohne Referenz / keine Daten
      </span>
    </div>
  );
}
