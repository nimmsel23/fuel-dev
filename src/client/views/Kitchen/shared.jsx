import { useRef, useState } from "react";
import { Camera, Upload, Loader2, RotateCcw } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { CATEGORIES, expiryStatus } from "../../lib/kitchenLogic.js";

export const cardClass = "rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur";
export const fieldClass = "rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-orange-400/50 focus:outline-none";
export const primaryBtn = "inline-flex items-center justify-center gap-2 rounded-xl bg-orange-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-orange-300 disabled:opacity-40";
export const ghostBtn = "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 disabled:opacity-40";

export function SectionTitle({ icon: Icon, title, hint, children }) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div>
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-orange-300" />}
          <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
        </div>
        {hint && <p className="mt-1 text-sm text-slate-400">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error.message || String(error)}</p>;
}

export function ExpiryBadge({ expiresOn }) {
  const { status, days } = expiryStatus(expiresOn);
  if (status === "none") return null;
  const label = status === "expired" ? `seit ${-days} T. abgelaufen` : status === "today" ? "läuft heute ab" : status === "soon" ? `noch ${days} T.` : `bis ${expiresOn.slice(8, 10)}.${expiresOn.slice(5, 7)}.`;
  const tone = status === "expired" ? "bg-red-500/15 text-red-300" : status === "today" || status === "soon" ? "bg-amber-400/15 text-amber-200" : "bg-white/5 text-slate-400";
  return <span className={twMerge("rounded-full px-2 py-0.5 text-[11px]", tone)}>{label}</span>;
}

// Kamera/Foto-Auswahl + Analyse mit Ladezustand und Retry auf derselben Datei. Das Bild wird nie gespeichert.
export function ImageCapture({ analyze, onResult, busyText = "Gemini liest das Foto …" }) {
  const camera = useRef(null);
  const picker = useRef(null);
  const last = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async (file) => {
    if (!file) return;
    last.current = file;
    setLoading(true);
    setError(null);
    try { onResult(await analyze(file)); }
    catch (e) { console.error(e); setError(e); }
    finally { setLoading(false); }
  };
  const pick = (e) => { const file = e.target.files?.[0]; e.target.value = ""; run(file); };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-slate-400">
        <Loader2 className="h-7 w-7 animate-spin text-orange-300" />
        <p className="text-sm">{busyText}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => camera.current?.click()} className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-slate-900 p-5 transition hover:bg-slate-800">
          <Camera className="h-6 w-6 text-orange-300" /><span className="text-sm font-medium text-slate-200">Kamera</span>
        </button>
        <button type="button" onClick={() => picker.current?.click()} className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-slate-900 p-5 transition hover:bg-slate-800">
          <Upload className="h-6 w-6 text-violet-300" /><span className="text-sm font-medium text-slate-200">Foto wählen</span>
        </button>
      </div>
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          <span>{error.message || "Fehler beim Lesen des Fotos."}</span>
          {last.current && <button type="button" onClick={() => run(last.current)} className="flex shrink-0 items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold hover:bg-red-500/30"><RotateCcw className="h-3.5 w-3.5" />Erneut</button>}
        </div>
      )}
      <input type="file" accept="image/*" capture="environment" className="hidden" ref={camera} onChange={pick} />
      <input type="file" accept="image/*" className="hidden" ref={picker} onChange={pick} />
    </div>
  );
}

const UNITS = ["g", "ml", "Stk", "Pkg"];

// Editierbare Review-Liste (Bon-Positionen / geparster Freitext): abwählen, Name/Menge/Einheit/Kategorie/Ablauf anpassen.
export function ItemReview({ items, onChange }) {
  const update = (idx, patch) => onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  return (
    <ul className="space-y-2">
      {items.map((it, idx) => (
        <li key={idx} className={twMerge("rounded-2xl border border-white/10 bg-slate-950/50 p-3", !it.sel && "opacity-50")}>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={it.sel} onChange={(e) => update(idx, { sel: e.target.checked })} aria-label={`${it.name} übernehmen`} className="h-4 w-4 accent-orange-400" />
            <input value={it.name} onChange={(e) => update(idx, { name: e.target.value })} aria-label="Name" className={twMerge(fieldClass, "min-w-0 flex-1")} />
            {it.price != null && <span className="shrink-0 text-xs tabular-nums text-slate-500">{String(it.price.toFixed(2)).replace(".", ",")} €</span>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
            <input type="number" min="0" step="any" value={it.qty} onChange={(e) => update(idx, { qty: e.target.value === "" ? "" : Number(e.target.value) })} aria-label="Menge" className={twMerge(fieldClass, "w-20")} />
            <select value={it.unit} onChange={(e) => update(idx, { unit: e.target.value })} aria-label="Einheit" className={fieldClass}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
            <select value={it.category} onChange={(e) => update(idx, { category: e.target.value })} aria-label="Kategorie" className={twMerge(fieldClass, "max-w-[11rem]")}>{CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
            <input type="date" value={it.expires_on || ""} onChange={(e) => update(idx, { expires_on: e.target.value })} aria-label="Ablaufdatum" title="Ablaufdatum (optional)" className={fieldClass} />
            {it.is_food === false && <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">Kein Lebensmittel</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
