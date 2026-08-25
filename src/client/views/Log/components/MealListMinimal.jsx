import { CopyPlus, Pencil, Trash2 } from "lucide-react";
import { twMerge } from "tailwind-merge";

const MEAL_LABEL_FALLBACK = (type) => type;

// "Refined Minimal" — ruhige Zeilenliste mit Trennlinien statt Karte-in-Karte,
// Zahlen rechtsbündig. Eine von drei wählbaren Log-Ansichten (siehe LogView).
export default function MealListMinimal({ meals, mealLabel, formId, onRepeat, onEdit, onDelete, repeatPendingId }) {
  return (
    <div>
      {meals.map((m) => (
        <div key={m.id}
          className={twMerge(
            "flex items-baseline justify-between gap-3 border-b border-white/5 px-1 py-3 transition last:border-b-0",
            formId === m.id && "bg-orange-400/5"
          )}>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-100">{m.description}</div>
            <div className="mt-0.5 text-[11.5px] text-slate-500">
              {mealLabel[m.type] || MEAL_LABEL_FALLBACK(m.type)}
              {" · "}P{m.protein} C{m.carbs} F{m.fat}
            </div>
          </div>
          <div className="flex shrink-0 items-baseline gap-3">
            <span className="text-sm font-semibold tabular-nums text-slate-100">
              {m.kcal}<span className="ml-0.5 text-[11px] font-normal text-slate-500">kcal</span>
            </span>
            <div className="flex gap-1">
              <button onClick={() => onRepeat(m)}
                disabled={repeatPendingId === m.id}
                title="Nochmal loggen"
                className="rounded-lg p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-400/10 transition">
                <CopyPlus className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => onEdit(m)}
                title="Bearbeiten"
                className={twMerge(
                  "rounded-lg p-1.5 transition",
                  formId === m.id ? "text-orange-400" : "text-slate-500 hover:text-orange-400 hover:bg-orange-400/10"
                )}>
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => onDelete(m.id)}
                title="Löschen"
                className="rounded-lg p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
