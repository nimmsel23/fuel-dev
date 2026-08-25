import { CopyPlus, Pencil, Trash2 } from "lucide-react";
import { twMerge } from "tailwind-merge";

// "Timeline" — Mahlzeiten hängen an einer Zeitachse statt an einer Liste,
// mit "Jetzt"-Marker. Eine von drei wählbaren Log-Ansichten (siehe LogView).
export default function MealListTimeline({
  meals, mealLabel, formId, onRepeat, onEdit, onDelete, repeatPendingId,
  getTime, nowLabel,
}) {
  return (
    <div className="relative pl-8">
      <div className="absolute bottom-1 left-[13px] top-1 w-px bg-gradient-to-b from-orange-400/50 to-white/5" aria-hidden />

      {meals.map((m) => (
        <div key={m.id} className="relative pb-4 last:pb-0">
          <span className={twMerge(
            "absolute -left-[19px] top-[3px] h-2.5 w-2.5 rounded-full border-2 bg-slate-950",
            formId === m.id ? "border-orange-400" : "border-orange-400/60"
          )} />
          <div className="mb-1 font-mono text-[10.5px] text-slate-500">
            {getTime(m)} · {mealLabel[m.type] || m.type}
          </div>
          <div className={twMerge(
            "group flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition",
            formId === m.id ? "border-orange-400/40 bg-orange-400/5" : "border-white/10 bg-white/5 hover:bg-white/[0.07]"
          )}>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-100">{m.description}</div>
              <div className="mt-0.5 text-[11px] tabular-nums text-slate-500">
                {m.kcal} kcal · P{m.protein} · C{m.carbs} · F{m.fat}
              </div>
            </div>
            <div className="flex shrink-0 gap-1 opacity-60 transition group-hover:opacity-100">
              <button onClick={() => onRepeat(m)} disabled={repeatPendingId === m.id} title="Nochmal loggen"
                className="rounded-lg p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 transition">
                <CopyPlus className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => onEdit(m)} title="Bearbeiten"
                className="rounded-lg p-1.5 text-slate-400 hover:text-orange-400 hover:bg-orange-400/10 transition">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => onDelete(m.id)} title="Löschen"
                className="rounded-lg p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}

      <div className="my-1 flex items-center gap-2">
        <span className="font-mono text-[10px] font-semibold text-sky-300">JETZT · {nowLabel}</span>
        <span className="h-px flex-1" style={{ backgroundImage: "repeating-linear-gradient(to right, rgb(125 211 252) 0 4px, transparent 4px 8px)" }} />
      </div>
    </div>
  );
}
