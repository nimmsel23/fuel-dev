import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UtensilsCrossed, Sparkles } from "lucide-react";
import { postJson } from "@api";

const inputCls = "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100";

const MEAL_TYPES = [
  { value: "breakfast", label: "Frühstück" },
  { value: "lunch",     label: "Mittagessen" },
  { value: "dinner",    label: "Abendessen" },
  { value: "snack",     label: "Snack" },
];

const MEAL_LABEL = Object.fromEntries(MEAL_TYPES.map(({ value, label }) => [value, label]));

export default function LogView({ date, nutrition }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  
  const meals = nutrition?.meals || [];

  const handleAiLog = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    try {
      await postJson("/nutrition/log", { text });
      qc.invalidateQueries({ queryKey: ["nutrition", date] });
      setText("");
    } catch (err) {
      console.error("AI Logging error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-8 max-w-3xl mx-auto">
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <UtensilsCrossed className="h-6 w-6 text-orange-300" />
          <h2 className="text-2xl font-bold tracking-tight">Ernährung</h2>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur shadow-glow">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-300" />
            AI Logger
          </h2>
          <form onSubmit={handleAiLog}>
            <textarea
              className={inputCls + " min-h-24 focus:ring-2 focus:ring-sky-400/50 outline-none transition-all"}
              placeholder="Was hast du gegessen? z.B. '200g Skyr mit Beeren'"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button
              disabled={loading || !text.trim()}
              className="mt-4 w-full bg-sky-300 text-slate-950 rounded-full py-3 font-bold disabled:opacity-50 hover:bg-sky-200 transition-colors shadow-lg active:scale-[0.98]"
            >
              {loading ? "Verarbeite..." : "Loggen"}
            </button>
          </form>
        </div>

        {meals.length > 0 && (
          <div className="space-y-2">
            <h3 className="px-1 text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">
              Geloggte Mahlzeiten
            </h3>
            {meals.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-slate-900/40 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-100">{m.description || m.name}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {MEAL_LABEL[m.type] || m.type || "Snack"}
                    {" · "}<span className="text-orange-300">{m.kcal || m.calories || 0} kcal</span>
                    {" · "}P {m.protein || 0}g · C {m.carbs || 0}g · F {m.fat || 0}g
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
