import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, UtensilsCrossed } from "lucide-react";
import { postJson } from "../lib/api.js";
import { MealRow } from "../components/ui.jsx";

const inputCls = "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100";

export default function FoodView({ activeDate, nutrition }) {
  const qc = useQueryClient();
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const meals = nutrition?.meals || [];

  const handleAiLog = async (e) => {
    e.preventDefault();
    if (!aiText.trim()) return;
    setAiLoading(true);
    try {
      await postJson("/nutrition/ai-log", { text: aiText, date: activeDate });
      qc.invalidateQueries({ queryKey: ["nutrition", activeDate] });
      qc.invalidateQueries({ queryKey: ["nutrition-weekly"] });
      qc.invalidateQueries({ queryKey: ["nutrition-catalog"] });
      setAiText("");
    } catch (err) {
      console.error("AI Logging error:", err);
      alert("Fehler bei der Verarbeitung.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="grid gap-6">
      {/* AI Dispatcher & Quick Logging */}
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur shadow-glow">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-300" />
            AI Logger
        </h2>
        <form onSubmit={handleAiLog}>
            <textarea 
                className={inputCls + " min-h-32 focus:ring-2 focus:ring-sky-400/50 outline-none transition-all"}
                placeholder="Was hast du gegessen? z.B. '200g Skyr mit Beeren'"
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
            />
            <button 
              disabled={aiLoading || !aiText.trim()} 
              className="mt-4 w-full bg-sky-300 text-slate-950 rounded-full py-4 font-bold disabled:opacity-50 hover:bg-sky-200 transition-colors shadow-lg active:scale-[0.98]"
            >
                {aiLoading ? "Verarbeite..." : "Eintrag loggen"}
            </button>
        </form>
      </section>

      {/* Heutige Logs */}
      <section className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
        <h3 className="mb-4 text-sm uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
          <UtensilsCrossed className="h-4 w-4 text-orange-300" />
          Heute geloggt
        </h3>
        <div className="grid gap-3">
          {meals.length ? meals.slice().reverse().map((meal) => (
            <MealRow key={meal.id} meal={meal} />
          )) : (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-400">Noch keine Einträge heute.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
