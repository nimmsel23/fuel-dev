import { CopyPlus, Pencil, Trash2 } from "lucide-react";
import { twMerge } from "tailwind-merge";

function StatTile({ label, value, unit, goal, color }) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-2.5 py-2.5">
      <div className="text-[9.5px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-0.5 text-base font-bold tabular-nums text-slate-100">{Math.round(value)}{unit}</div>
      <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// "Data-Dashboard" — Tagesbilanz als vier Kennzahlen-Kacheln + dichte
// Tabellenzeilen mit Makro-Fingerabdruck (Protein/Carbs/Fett-Anteil als
// Farbsegmente). Eine von drei wählbaren Log-Ansichten (siehe LogView).
export default function MealListDashboard({
  meals, mealLabel, formId, onRepeat, onEdit, onDelete, repeatPendingId,
  totals, goals, getTime,
}) {
  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        <StatTile label="Kcal" value={totals.kcal} unit="" goal={goals.kcal_goal} color="#fb923c" />
        <StatTile label="Protein" value={totals.protein} unit="g" goal={goals.protein_goal} color="#34d399" />
        <StatTile label="Carbs" value={totals.carbs} unit="g" goal={goals.carbs_goal} color="#38bdf8" />
        <StatTile label="Fett" value={totals.fat} unit="g" goal={goals.fat_goal} color="#a78bfa" />
      </div>

      <div className="mt-4 grid grid-cols-[44px_1fr_60px_50px] items-center gap-2 border-b border-white/10 pb-2 text-[9.5px] uppercase tracking-[0.12em] text-slate-500">
        <span></span>
        <span>Mahlzeit</span>
        <span className="text-center">Makros</span>
        <span className="text-right">Kcal</span>
      </div>

      {meals.map((m) => {
        const sum = (m.protein || 0) + (m.carbs || 0) + (m.fat || 0) || 1;
        const pPct = (m.protein / sum) * 100;
        const cPct = (m.carbs / sum) * 100;
        const fPct = (m.fat / sum) * 100;
        return (
          <div key={m.id}
            className={twMerge(
              "group grid grid-cols-[44px_1fr_60px_50px] items-center gap-2 border-b border-white/5 py-2 transition last:border-b-0",
              formId === m.id && "bg-orange-400/5"
            )}>
            <span className="font-mono text-[10px] text-slate-500">{getTime(m)}</span>
            <span className="truncate text-[13px] text-slate-200" title={m.description}>{m.description}</span>
            <span className="mx-auto flex h-1.5 w-14 overflow-hidden rounded-full bg-white/5" title={`P${m.protein} C${m.carbs} F${m.fat}`}>
              <span style={{ width: `${pPct}%`, backgroundColor: "#34d399" }} />
              <span style={{ width: `${cPct}%`, backgroundColor: "#38bdf8" }} />
              <span style={{ width: `${fPct}%`, backgroundColor: "#a78bfa" }} />
            </span>
            <span className="text-right text-[13px] font-bold tabular-nums text-slate-100">{m.kcal}</span>
            <div className="col-span-4 mt-1 hidden justify-end gap-1 group-hover:flex">
              <span className="mr-auto text-[10px] text-slate-500">{mealLabel[m.type] || m.type}</span>
              <button onClick={() => onRepeat(m)} disabled={repeatPendingId === m.id} title="Nochmal loggen"
                className="rounded-lg p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-400/10 transition">
                <CopyPlus className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => onEdit(m)} title="Bearbeiten"
                className="rounded-lg p-1.5 text-slate-500 hover:text-orange-400 hover:bg-orange-400/10 transition">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => onDelete(m.id)} title="Löschen"
                className="rounded-lg p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
