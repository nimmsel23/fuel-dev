export default function MicrosLegend() {
  return (
    <div className="flex gap-4 text-xs text-slate-400">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded" style={{ background: "#16a34a" }} /> ≥ 90%
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded" style={{ background: "#d97706" }} /> 50–89%
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded" style={{ background: "#dc2626" }} /> &lt; 50%
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded" style={{ background: "rgba(30,41,59,0.4)", border: "1px solid #334155" }} /> keine Daten
      </span>
    </div>
  );
}
