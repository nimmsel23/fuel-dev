import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { twMerge } from "tailwind-merge";
import { BookmarkPlus, ChefHat, Sparkles, Trash2, UtensilsCrossed, Pencil } from "lucide-react";
import { fetchJson, postJson } from "../lib/api.js";
import FoodSearch from "../components/FoodSearch.jsx";
import { Field, Input, MealRow } from "../components/ui.jsx";

const MEAL_TYPES = [
  { value: "breakfast", label: "Frühstück" },
  { value: "lunch",     label: "Mittagessen" },
  { value: "dinner",    label: "Abendessen" },
  { value: "snack",     label: "Snack" },
];

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
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-300" />
            AI Logger
        </h2>
        <form onSubmit={handleAiLog}>
            <textarea 
                className={inputCls + " min-h-32"}
                placeholder="z.B. '200g Skyr mit Beeren' oder 'Füge Döner zum Katalog hinzu...'"
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
            />
            <button disabled={aiLoading || !aiText.trim()} className="mt-4 bg-sky-300 text-slate-950 rounded-full px-5 py-3 font-medium disabled:opacity-60">
                {aiLoading ? "Verarbeite..." : "Loggen / Katalogisieren"}
            </button>
        </form>
      </section>

      {/* Heutige Logs */}
      <section className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
        <h3 className="mb-4 text-lg font-semibold flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5 text-orange-300" />
          Heute gegessen
        </h3>
        <div className="grid gap-3">
          {meals.length ? meals.slice().reverse().map((meal) => <MealRow key={meal.id} meal={meal} />) : <p className="text-sm text-slate-400">Keine Einträge heute.</p>}
        </div>
      </section>
    </div>
  );
}
